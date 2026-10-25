import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentHash, storedInBlock, ReviveContract } from '@portion/sdk';
import { publicApi } from '../src/public-api';
import { restoreDocumentArchive } from '../src/document-archive';
const blobs = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock('@vercel/blob', () => ({
  list: vi.fn(async ({ prefix }: { prefix: string }) => ({ hasMore: false, blobs: [...blobs.keys()].filter(key => key.startsWith(prefix)).map(pathname => ({ pathname, url: 'https://public.test/' + pathname })) })),
  put: vi.fn(async (path: string, bytes: Uint8Array) => { if (blobs.has(path)) throw new Error('Already exists'); blobs.set(path, new Uint8Array(bytes)); return {}; }),
}));
vi.mock('@portion/sdk', async original => ({ ...await original<object>(), storedInBlock: vi.fn() }));
const deployment: any = { contractVersion: 'core-v1', portion: '0x1111111111111111111111111111111111111111', deedsCollection: 9, pusdAssetId: 4217 };
beforeEach(() => {
  blobs.clear(); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-only-token');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(blobs.get(url.replace('https://public.test/', '')), { status: blobs.has(url.replace('https://public.test/', '')) ? 200 : 404 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function fixture() {
  const api: any = { genesisHash: { toHex: () => '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd' },
    rpc: { chain: { getFinalizedHead: async () => '0xfinal', getHeader: async () => ({ number: { toNumber: () => 10 } }), getBlockHash: async () => ({ toHex: () => '0xblock' }) } }, disconnect: vi.fn(async () => {}) };
  return { api, app: publicApi(deployment, async () => api) };
}
describe('durable public API', () => {
  it('never presents a missing deployment or store as working data', async () => {
    expect((await publicApi(undefined).request('/api/catalog')).status).toBe(503);
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    expect((await fixture().app.request('/api/catalog')).status).toBe(503);
  });
  it('publishes only accepted, finalized document bytes and serves their exact content', async () => {
    const { app, api } = fixture(); const data = new TextEncoder().encode('{"terms":"operator terms"}'); const hash = contentHash(data);
    vi.mocked(storedInBlock).mockResolvedValue([{ data, hash, size: data.length, block: 9, index: 0 }]);
    const response = await app.request(`/api/doc/${hash}/pin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: 9 }) });
    expect(response.status).toBe(200); expect(api.disconnect).toHaveBeenCalled();
    expect(await (await app.request(`/api/doc/${hash}`)).text()).toBe(new TextDecoder().decode(data));
  });
  it('rejects unfinalized blocks before writing any public files', async () => {
    const { app } = fixture();
    expect((await app.request(`/api/doc/${'0x' + 'ab'.repeat(32)}/pin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"block":11}' })).status).toBe(409);
    expect(blobs.size).toBe(0);
  });
  it('repairs a missing anchor after a document copy succeeded in an earlier request', async () => {
    const { app } = fixture(); const data = new TextEncoder().encode('previously copied document'); const hash = contentHash(data);
    const prefix = `portion/core-v1/${deployment.portion}/`;
    blobs.set(prefix + `docs/${hash}`, data);
    vi.mocked(storedInBlock).mockResolvedValue([{ data, hash, size: data.length, block: 9, index: 0 }]);
    const response = await app.request(`/api/doc/${hash}/pin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"block":9}' });
    expect(response.status).toBe(200);
    expect(blobs.has(prefix + `anchors/${hash}`)).toBe(true);
    expect(blobs.get(prefix + `docs/${hash}`)).toEqual(data);
  });
  it('keeps an empty published catalog empty and labels receipt coverage honestly', async () => {
    const { app } = fixture();
    expect(await (await app.request('/api/catalog')).json()).toEqual([]);
    expect(await (await app.request('/api/health')).json()).toMatchObject({ indexedHistoryComplete: false, mode: 'core-v1-public-receipts' });
  });
  it('reconciles published allocations with one finalized contract snapshot', async () => {
    const { app, api } = fixture();
    const finalized = { toHex: () => '0xfinal' };
    api.rpc.chain.getFinalizedHead = async () => finalized;
    api.at = vi.fn(async () => ({ snapshot: true }));
    vi.spyOn(ReviveContract.prototype, 'read').mockResolvedValue({ revenue: 200n });
    blobs.set(`portion/core-v1/${deployment.portion}/receipts/fixture`, new TextEncoder().encode(JSON.stringify({ block: 9, ts: 1, txHash: 'fixture', rows: [{ kind: 'RevenueDeposited', listingId: 777, actor: null, data: { net: '50' } }] })));
    const response = await app.request('/api/listings/777/history');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ finalizedBlock: 10, finalizedHash: '0xfinal', contractTotal: '200', publishedTotal: '50', missingAllocation: '150', indexedHistoryComplete: false });
    expect(api.at).toHaveBeenCalledWith(finalized);
    expect(api.disconnect).toHaveBeenCalled();
  });
  it('verifies a transaction only in its supplied finalized block, and requires a dispatch outcome', async () => {
    const { app, api } = fixture(); const hash = '0x' + 'ab'.repeat(32);
    const event = { kind: 'success' };
    api.rpc.chain.getBlock = async () => ({ block: { extrinsics: [{ hash: { toHex: () => hash }, isSigned: true, signer: { toString: () => 'native-account' }, method: { hash: { toHex: () => hash } }, nonce: { toString: () => '1' } }] } });
    const records: any[] = [{ phase: { isApplyExtrinsic: true, asApplyExtrinsic: { toNumber: () => 0 } }, event }];
    api.at = async () => ({ query: { system: { events: async () => records } }, events: { system: { ExtrinsicSuccess: { is: (e: any) => e.kind === 'success' }, ExtrinsicFailed: { is: (e: any) => e.kind === 'failed' } } } });
    expect((await app.request(`/api/transactions/${hash}?block=11`)).status).toBe(409);
    expect((await app.request(`/api/transactions/0x${'cd'.repeat(32)}?block=9`)).status).toBe(404);
    expect(await (await app.request(`/api/transactions/${hash}?block=9`)).json()).toMatchObject({ finalized: true, ok: true, signer: 'native-account', blockNumber: 9 });
    records.length = 0;
    expect((await app.request(`/api/transactions/${hash}?block=9`)).status).toBe(503);
  });
  it('refuses an unproved credit recipient without connecting to the chain or signing',async()=>{
    const connect=vi.fn(); const app=publicApi(deployment,connect);
    const response=await app.request('/api/drip',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:'5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4',signature:'0x00'})});
    expect(response.status).toBe(401); expect(connect).not.toHaveBeenCalled();
  });
  it('serves restored hash-verified bytes after a fresh API instance without native document retention',async()=>{
    const photo=new Uint8Array([1,2,3]); const coverHash=contentHash(photo);
    const terms=new TextEncoder().encode(JSON.stringify({v:1,assetId:777,nftCollection:9,nftItem:3,name:'Fixture',summary:'',terms:'Fixture terms',category:0,coverHash})); const docHash=contentHash(terms);
    const archive={v:1,contract:deployment.portion,collection:9,exportedAt:new Date().toISOString(),source:'isolated restart fixture',catalog:[{assetId:777,docHash}],documents:[{hash:docHash,base64:Buffer.from(terms).toString('base64')},{hash:coverHash,base64:Buffer.from(photo).toString('base64')}]};
    const restored=restoreDocumentArchive(JSON.parse(JSON.stringify(archive)),deployment.portion);
    for(const [hash,bytes] of restored.documents) blobs.set(`portion/core-v1/${deployment.portion}/docs/${hash}`,bytes);
    const unavailableNative=vi.fn(async()=>{throw new Error('Native document history is unavailable');});
    const fresh=publicApi(deployment,unavailableNative);
    expect(await (await fresh.request(`/api/doc/${docHash}`)).text()).toBe(new TextDecoder().decode(terms));
    expect(unavailableNative).not.toHaveBeenCalled();
  });
});
