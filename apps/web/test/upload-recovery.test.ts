import { afterEach, describe, expect, it, vi } from 'vitest';
import { submit, contentHash, UnconfirmedTransactionError } from '@portion/sdk';
import { LiveBackend } from '../src/lib/live';
import { loadUpload, reconcileUploads } from '../src/lib/upload-checkpoint';
vi.mock('@portion/sdk', async original => ({ ...await original<object>(), nativeFree: vi.fn(async () => 100n * 10n ** 14n), assetBalance: vi.fn(async () => 10000000000n),
  mappedCorePlan: vi.fn(async (_api,plan) => plan), submit: vi.fn(),
  storeTx: vi.fn((_api,bytes) => ({ paymentInfo: async () => ({ partialFee: 100n }), method: { hash: { toHex: () => contentHash(bytes) } } })),
}));
const hash = (n: number) => '0x' + n.toString(16).padStart(64,'0');
function storage() { const data = new Map<string,string>(); return { get length() { return data.size; }, key: (i: number) => [...data.keys()][i] ?? null, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string,value: string) => { data.set(key,value); }, removeItem: (key: string) => { data.delete(key); }, clear: () => data.clear() } as Storage; }
const who: any = { address: '5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4', h160: '0x'+'11'.repeat(20), pair: { address: 'fixture-signer' } };
const form: any = { name: 'Fixture only', summary: '', category: 0, terms: 'Fixture terms', totalShares: 100, sharesForSale: 100, pricePusd: '1', cadenceSeconds: 604800, minPerPeriodPusd: '1', bondPusd: '5', image: { bytes: new Uint8Array([1,2,3]), mime: 'image/jpeg' } };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.mocked(submit).mockReset(); });
function fixture() {
  const store = storage(); vi.stubGlobal('localStorage',store);
  const api: any = { rpc: { chain: { getFinalizedHead: async () => hash(10), getHeader: async () => ({ number: { toNumber: () => 10 } }) }, system: { accountNextIndex: async () => ({ toString: () => '1' }) } }, query: { assets: { asset: async () => ({ isSome: false }) }, nfts: { item: async () => ({ isSome: false }) } } };
  const backend = new LiveBackend(api,{ portion: '0x'+'22'.repeat(20), pusdAssetId: 4217, deedsCollection: 9, contractVersion: 'core-v1' } as any);
  vi.spyOn(backend,'rules').mockResolvedValue({ saleFeeBps:100,revenueFeeBps:50,minBondBps:500,slashTipBps:100,minCadence:60 });
  const client = backend.client!;
  const free = vi.spyOn(client as any,'freeAssetId').mockResolvedValue(777);
  vi.spyOn(client,'freeNftItem').mockResolvedValue(3);
  let docHash = '';
  const plan = vi.spyOn(client,'planTokenize').mockImplementation(async (_who,input) => { docHash = input.docHash; return { assetId:777,nftItem:3,steps:[],tx: { paymentInfo: async () => ({partialFee:100n}), method:{ hash:{toHex:()=>hash(99)} } } } as any; });
  vi.spyOn(client.contract,'read').mockImplementation(async () => ({docHash,operator:who.h160}));
  vi.stubGlobal('fetch',vi.fn(async () => new Response('{}',{headers:{'content-type':'application/json'}})));
  let count = 100;
  vi.mocked(submit).mockImplementation(async () => ({ok:true,txHash:hash(++count),blockHash:hash(10),blockNumber:10,events:[]}));
  return { backend,store,free,plan,api };
}
describe('recoverable native asset creation', () => {
  it.each(['photo rejection','pin outage'])('reuses accepted terms and identifiers after %s',async failure => {
    const f = fixture();
    if(failure==='photo rejection') vi.mocked(submit).mockImplementationOnce(async () => ({ok:true,txHash:hash(1),blockHash:hash(10),blockNumber:10,events:[]})).mockRejectedValueOnce(new Error('User rejected photo signature'));
    else vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"pin unavailable"}',{status:503,headers:{'content-type':'application/json'}}));
    const first = await f.backend.prepare({kind:'tokenize',form},who);
    expect((await first.run(()=>{})).ok).toBe(false);
    const next = await f.backend.prepare({kind:'tokenize',form},who);
    expect(next.steps[0].title).toContain('Reuse finalized terms');
    expect((await next.run(()=>{})).ok).toBe(true);
    expect(f.free).toHaveBeenCalledTimes(1);
    expect(f.plan.mock.calls[0][1].docHash).toBe(f.plan.mock.calls[1][1].docHash);
    expect(submit).toHaveBeenCalledTimes(failure==='photo rejection'?4:3);
    const calls = vi.mocked(submit).mock.calls;
    expect(calls.filter(call => call[1].method.hash.toHex()===calls[0][1].method.hash.toHex())).toHaveLength(1);
    // Reopening an already finalized form only republishes its receipt.
    const again = await f.backend.prepare({kind:'tokenize',form},who);
    expect((await again.run(()=>{})).ok).toBe(true);
    expect(submit).toHaveBeenCalledTimes(failure==='photo rejection'?4:3);
  });
  it('blocks unknown uploads until signer, call hash and nonce match a finalized outcome',async () => {
    const f = fixture(); vi.mocked(submit).mockRejectedValueOnce(new UnconfirmedTransactionError('Tracking lost',hash(8)));
    const prepared = await f.backend.prepare({kind:'tokenize',form},who);
    expect(await prepared.run(()=>{})).toMatchObject({ok:false,unconfirmed:true,txHash:hash(8)});
    await expect(f.backend.prepare({kind:'tokenize',form},who)).rejects.toThrow('unconfirmed');
    const key = f.store.key(0)!; const fingerprint = key.slice('portion.upload.v1:'.length); const saved = loadUpload(f.store,fingerprint)!;
    const outcome = {signer:who.address,txHash:hash(8),blockHash:hash(10),blockNumber:10,callHash:saved.pending!.callHash,nonce:'2',ok:true};
    expect(reconcileUploads(f.store,outcome)).toBe(0);
    expect(reconcileUploads(f.store,{...outcome,nonce:'1'})).toBe(1);
    expect((await f.backend.prepare({kind:'tokenize',form},who)).steps[0].title).toContain('Reuse finalized');
  });
  it('refuses an occupied native identifier instead of silently changing the hashed terms', async () => {
    const f = fixture(); f.api.query.assets.asset = async () => ({isSome:true});
    const prepared = await f.backend.prepare({kind:'tokenize',form},who);
    expect(await prepared.run(()=>{})).toMatchObject({ok:false,error:expect.stringContaining('new immutable terms')});
    expect(submit).toHaveBeenCalledTimes(2); // documents only; no creation with stale IDs
    expect(f.free).toHaveBeenCalledTimes(1);
  });
});
