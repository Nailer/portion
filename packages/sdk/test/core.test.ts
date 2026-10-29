import { describe, expect, it, vi } from 'vitest';
import { CoreClient, coreDocument, type CoreDocument } from '../src/core';
import { assetErc20Address, ss58ToH160 } from '../src/addresses';
import type { Deployment } from '../src/portion';
const hash = '0x' + 'ab'.repeat(32);
const deployment = { contractVersion: 'core-v1', portion: '0x1111111111111111111111111111111111111111', pusdAssetId: 4217, deedsCollection: 9, treasury:'5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4' } as Deployment;
const doc: CoreDocument = { v: 1, assetId: 777, nftCollection: 9, nftItem: 1, name: 'Operator-supplied equipment', summary: 'Terms supplied by the operator', category: 0, terms: 'Pay per the agreed schedule.', coverHash: hash };
const row = { operator: deployment.portion, cadence: 604800n, totalShares: 100n, lastDepositAt: 100n, closedAt: 0n, saleOpen: false, docHash: hash, minimum: 20_000_000n, price: 10_000_000n, forSale: 0n, staked: 5n, acc: 0n, bond: 50_000_000n, revenue: 3_000_000n, sold: 10n };
function fixture() {
  const source = { catalog: async () => [{ assetId: 777, docHash: hash, createdAt: 50, block: 10, txHash: hash }], document: async () => doc };
  const client = new CoreClient({} as any, deployment, source);
  const read = vi.spyOn(client.contract, 'read').mockImplementation(async method => method === 'listing' ? row : method === 'health' ? 0n : method === 'paymentToken' || method === 'shareToken' ? assetErc20Address(4217) : method === 'treasury' ? ss58ToH160(deployment.treasury) : method === 'stakes' ? { amount: 0n } : 5n);
  return { client, read, source };
}
describe('Core v1 adapter', () => {
  it('preserves actual sold count after sale closure and leaves unavailable counters unknown', async () => {
    const { client } = fixture(); const listing = await client.listing(777);
    expect(listing.vault).toMatchObject({ sold: 10, forSale: 0, totalStaked: 5n, deposits: null });
    expect(listing.strikes).toBeNull(); expect(listing.createdAt).toBe(50);
  });
  it('does not replace missing documents or mismatched hashes with example metadata', async () => {
    const { client, source } = fixture(); source.document = async () => null as any;
    await expect(client.listing(777)).rejects.toThrow('document');
    const f = fixture(); f.read.mockImplementation(async () => ({ ...row, docHash: '0xwrong' }));
    await expect(f.client.listing(777)).rejects.toThrow('differs');
  });
  it('keeps earned claims visible after a user unstakes every share', async () => {
    const { client } = fixture();
    expect(await client.positions('5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4')).toEqual([{ id: 777, staked: 0, pending: 5n }]);
  });
  it('binds versioned fixed rules to the actual configured payment token', async () => {
    const { client, read } = fixture(); expect((await client.rules()).saleFeeBps).toBe(100);
    read.mockResolvedValue('0x0000000000000000000000000000000000000000');
    await expect(client.rules()).rejects.toThrow('does not match');
  });
  it('rejects documents claiming another native asset or collection', () => {
    expect(() => coreDocument(doc, 778, 9)).toThrow();
    expect(() => coreDocument(doc, 777, 10)).toThrow();
  });
  it.each(['shareToken','treasury'])('rejects a runtime-code match with mismatched %s constructor state',async method=>{
    const {client,read}=fixture(); const normal=read.getMockImplementation()!;
    read.mockImplementation(async (fn,...args)=>fn===method?'0x'+'00'.repeat(20):normal(fn,...args));
    await expect(client.rules()).rejects.toThrow(method==='shareToken'?'share-address mapping':'treasury');
  });
});

describe('Core account mapping', () => {
  it('keeps an already mapped native plan and rejects an address collision', async () => {
    const { mappedCorePlan } = await import('../src/core');
    const api: any = { call: { reviveApi: { accountId: vi.fn(async () => ({ toString: (): string => 'native' })) } }, query: { revive: { originalAccount: vi.fn(async () => ({isSome:true})) } } };
    const plan: any = { tx: {method:{}},steps:[] }; const who: any = {address:'native',h160:'contract'};
    expect(await mappedCorePlan(api,plan,who)).toBe(plan);
    expect(api.query.revive.originalAccount).not.toHaveBeenCalled();
    api.call.reviveApi.accountId.mockResolvedValue({toString:()=> 'another-native-account'});
    await expect(mappedCorePlan(api,plan,who)).rejects.toThrow('already linked');
  });
  it('prepends mapping in a flat batch and never nests a filtered utility batch', async () => {
    const { mappedCorePlan } = await import('../src/core');
    const mappingCall = { section: 'revive', method: 'mapAccount' };
    const existing = { section: 'revive', method: 'call' };
    const batchAll = vi.fn(calls => ({ calls }));
    const api: any = { call: { reviveApi: { accountId: async () => ({ toString: () => 'fallback' }) } }, query: { revive: { originalAccount: async () => ({ isSome: false }) } }, tx: { revive: { mapAccount: () => ({ method: mappingCall }) }, utility: { batchAll } } };
    await mappedCorePlan(api, { tx: { method: { section: 'utility', method: 'batchAll', args: [[existing]] } }, steps: [] } as any, { address: 'native', h160: '0xaccount' } as any);
    expect(batchAll).toHaveBeenCalledWith([mappingCall, existing]);
  });
});

describe('Core deed creation safety', () => {
  it('pins the exact 32-byte hash without requiring collection-freezer permission', async () => {
    const call = (section: string, method: string) => vi.fn((...args: unknown[]) => ({ section, method, args }));
    const api: any = { tx: {
      nfts: { mint: call('nfts','mint'), setAttribute: call('nfts','setAttribute'), lockItemTransfer: call('nfts','lockItemTransfer') },
      nftFractionalization: { fractionalize: call('nftFractionalization','fractionalize') },
      assets: { approveTransfer: call('assets','approveTransfer') }, revive: { call: call('revive','call') },
      utility: { batchAll: vi.fn(calls => ({ calls })) },
    } };
    const client = new CoreClient(api, deployment, fixture().source);
    await client.planTokenize({ address: 'operator' } as any, { assetId: 777, nftItem: 1, name: 'Test', summary: '', category: 7, totalShares: 100, sharesForSale: 100, salePrice: 1_000_000n, cadence: 604800, minPerPeriod: 1_000_000n, bond: 5_000_000n, docHash: hash, coverHash: hash });
    expect(api.tx.nfts.setAttribute.mock.calls[0][4]).toBe(hash);
    const calls = api.tx.utility.batchAll.mock.calls[0][0];
    expect(calls.map((c: any) => c.method)).toEqual(['mint','setAttribute','fractionalize','approveTransfer','approveTransfer','call']);
    expect(api.tx.nfts.lockItemTransfer).not.toHaveBeenCalled();
  });
});

describe('Core v2 adapter', async () => {
  const { escrowView, validateControls } = await import('../src/core');
  const guardian = '0x' + '66'.repeat(20);
  const reviewer = '0x' + '2e'.repeat(20);
  const v2deployment = { ...deployment, contractVersion: 'core-v2', guardian } as Deployment;
  const now = Math.floor(Date.now() / 1000);
  const v2row = { ...row, saleOpen: undefined, phase: 2n, activated: true, reviewer, recovery: '0x' + '00'.repeat(20), pendingOperator: '0x' + '00'.repeat(20),
    pendingAfter: 0n, deadline: BigInt(now + 86_400), minSold: 50n, raised: 1_000n, released: 500n, refundPool: 0n, refunded: 0n,
    nextTranche: 1n, lapses: 0n, proposalOpen: false, evidence: '0x' + '00'.repeat(32), proposedAt: 0n, approvedAt: 0n, challenged: false,
    otherDeposits: 7n, reserve: 0n, windDownAfter: 0n };
  function v2fixture(overrides: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
    const source = { catalog: async () => [{ assetId: 777, docHash: hash, createdAt: 50, block: 10, txHash: hash }], document: async () => doc };
    const call = vi.fn(() => ({ method: {} }));
    const client = new CoreClient({ tx: { revive: { call }, utility: { batchAll: vi.fn((calls: unknown[]) => ({ calls })) }, assets: { approveTransfer: vi.fn(() => 'approve') } } } as any, v2deployment, source);
    const values: Record<string, unknown> = { listing: { ...v2row, ...overrides }, tranches: [5000n, 5000n], health: 0n, paymentToken: assetErc20Address(4217),
      shareToken: assetErc20Address(4217), treasury: ss58ToH160(deployment.treasury), guardian, stakes: { amount: 0n }, pending: 0n, paid: 600n, refundTaken: false, ...extra };
    const read = vi.spyOn(client.contract, 'read').mockImplementation(async method => values[method]);
    return { client, read, call };
  }
  it('reads escrow, release schedule and separately counted outside deposits', async () => {
    const { client } = v2fixture(); const listing = await client.listing(777);
    expect(listing.escrow).toMatchObject({ phase: 'Active', activated: true, reviewer, recovery: null, escrowed: 500n, tranches: [5000, 5000], nextTranche: 1, proposal: null, otherDeposits: 7n });
    expect(listing.saleOpen).toBe(false);
  });
  it('treats a sale as open only while funding, before the deadline, with shares left', async () => {
    expect((await v2fixture({ phase: 1n, activated: false, forSale: 10n }).client.listing(777)).saleOpen).toBe(true);
    expect((await v2fixture({ phase: 1n, activated: false, forSale: 10n, deadline: BigInt(now - 1) }).client.listing(777)).saleOpen).toBe(false);
    expect((await v2fixture({ phase: 0n, activated: false, forSale: 10n }).client.listing(777)).saleOpen).toBe(false);
  });
  it('shows an open tranche proposal and rejects unknown phases', () => {
    expect(escrowView({ ...v2row, proposalOpen: true, proposedAt: 5n, approvedAt: 9n, challenged: true }, [10_000n]).proposal).toEqual({ evidence: v2row.evidence, proposedAt: 5, approvedAt: 9, challenged: true });
    expect(() => escrowView({ ...v2row, phase: 4n }, [])).toThrow('phase');
  });
  it('lists a refund the account has not yet taken, pro rata to what it paid', async () => {
    const { client } = v2fixture({ phase: 3n, refundPool: 500n });
    expect(await client.positions(deployment.treasury)).toEqual([{ id: 777, staked: 0, pending: 0n, refundable: 300n }]);
    const taken = v2fixture({ phase: 3n, refundPool: 500n }, { refundTaken: true });
    expect(await taken.client.positions(deployment.treasury)).toEqual([]);
  });
  it('refuses a deployment whose guardian differs from the disclosed configuration', async () => {
    expect((await v2fixture().client.rules()).saleFeeBps).toBe(100);
    await expect(v2fixture({}, { guardian: '0x' + '99'.repeat(20) }).client.rules()).rejects.toThrow('guardian');
  });
  it('builds v2 actions and refuses them on a v1 deployment', async () => {
    const { client, call } = v2fixture();
    client.planRelease(777); client.planAttest(777, hash);
    expect(call).toHaveBeenCalledTimes(2);
    expect(() => client.planAttest(777, '0x1234')).toThrow('hash');
    expect(() => client.planOperator('closeSale', 777)).toThrow('finalize');
    const v1 = fixture().client;
    expect(() => v1.planRefund(777)).toThrow('Core v2');
  });
  describe('funding controls', () => {
    const operator = '0x' + 'aa'.repeat(20);
    const input: any = { sharesForSale: 100, salePrice: 10_000_000n, cadence: 604_800, minPerPeriod: 20_000_000n,
      controls: { reviewer, minSold: 50, deadline: now + 86_400, tranches: [5000, 5000] } };
    it('accepts independent roles, a reachable target and a whole release schedule', () => {
      expect(validateControls(input, operator, now)).toEqual({ reviewer, recovery: '0x' + '00'.repeat(20) });
    });
    it.each([
      ['reviewer is the operator', { reviewer: operator }, 'independent'],
      ['recovery is the reviewer', { recovery: reviewer }, 'recovery'],
      ['target above the offer', { minSold: 101 }, 'target'],
      ['deadline passed', { deadline: now }, 'deadline'],
      ['schedule short of 100%', { tranches: [5000, 4999] }, 'tranches'],
    ])('rejects a %s', (_, change, message) => {
      expect(() => validateControls({ ...input, controls: { ...input.controls, ...change } }, operator, now)).toThrow(new RegExp(message, 'i'));
    });
    it('mirrors the on-chain minimum-deposit floor', () => {
      expect(() => validateControls({ ...input, minPerPeriod: 383_561n }, operator, now)).toThrow('2%');
      expect(() => validateControls({ ...input, minPerPeriod: 383_562n }, operator, now)).not.toThrow();
    });
    it('requires the controls on v2', () => { expect(() => validateControls({ ...input, controls: undefined }, operator, now)).toThrow('reviewer'); });
  });
});
