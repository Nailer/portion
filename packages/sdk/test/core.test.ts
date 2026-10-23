import { describe, expect, it, vi } from 'vitest';
import { CoreClient, coreDocument, type CoreDocument } from '../src/core';
import { assetErc20Address } from '../src/addresses';
import type { Deployment } from '../src/portion';
const hash = '0x' + 'ab'.repeat(32);
const deployment = { contractVersion: 'core-v1', portion: '0x1111111111111111111111111111111111111111', pusdAssetId: 4217, deedsCollection: 9 } as Deployment;
const doc: CoreDocument = { v: 1, assetId: 777, nftCollection: 9, nftItem: 1, name: 'Operator-supplied equipment', summary: 'Terms supplied by the operator', category: 0, terms: 'Pay per the agreed schedule.', coverHash: hash };
const row = { operator: deployment.portion, cadence: 604800n, totalShares: 100n, lastDepositAt: 100n, closedAt: 0n, saleOpen: false, docHash: hash, minimum: 20_000_000n, price: 10_000_000n, forSale: 0n, staked: 5n, acc: 0n, bond: 50_000_000n, revenue: 3_000_000n, sold: 10n };
function fixture() {
  const source = { catalog: async () => [{ assetId: 777, docHash: hash, createdAt: 50, block: 10, txHash: hash }], document: async () => doc };
  const client = new CoreClient({} as any, deployment, source);
  const read = vi.spyOn(client.contract, 'read').mockImplementation(async method => method === 'listing' ? row : method === 'health' ? 0n : method === 'paymentToken' ? assetErc20Address(4217) : method === 'stakes' ? { amount: 0n } : 5n);
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
});

describe('Core account mapping', () => {
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
