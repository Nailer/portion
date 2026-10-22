import { describe, expect, it } from 'vitest';
import { contentHash, storedInBlock } from '../src/storage';

function fixture({ accepted = true, failed = false, wrongHash = false } = {}) {
  const bytes = new Uint8Array([1, 2, 3]);
  const phase = { isApplyExtrinsic: true, asApplyExtrinsic: { toNumber: () => 2 } };
  const records = [
    ...(accepted ? [{ phase, event: { method: 'Stored', data: [{ toNumber: () => 0 }, { toHex: () => wrongHash ? '0xwrong' : contentHash(bytes) }] } }] : []),
    ...(failed ? [{ phase, event: { method: 'ExtrinsicFailed', data: [] } }] : []),
  ];
  const api = {
    rpc: { chain: { getBlock: async () => ({ block: { header: { number: { toNumber: () => 42 } }, extrinsics: [
      { method: { section: 'timestamp' } }, { method: { section: 'system' } },
      { method: { section: 'transactionStorage', method: 'store', args: [{ toHex: () => '0x010203' }] } },
    ] } }) } },
    at: async () => ({ query: { system: { events: async () => records } } }),
    events: { system: { ExtrinsicFailed: { is: (event: any) => event.method === 'ExtrinsicFailed' } }, transactionStorage: { Stored: { is: (event: any) => event.method === 'Stored' } } },
  };
  return { api: api as any, bytes };
}
describe('verified on-chain documents', () => {
  it('uses the emitted storage index even when the extrinsic appears elsewhere in the block', async () => {
    const f = fixture();
    expect(await storedInBlock(f.api, '0xblock')).toEqual([{ hash: contentHash(f.bytes), size: 3, block: 42, index: 0, data: f.bytes }]);
  });
  it('never verifies bytes merely because a store was attempted', async () => {
    expect(await storedInBlock(fixture({ accepted: false }).api, '0xblock')).toEqual([]);
    expect(await storedInBlock(fixture({ failed: true }).api, '0xblock')).toEqual([]);
  });
  it('rejects bytes whose hash differs from the accepted event', async () => {
    await expect(storedInBlock(fixture({ wrongHash: true }).api, '0xblock')).rejects.toThrow('hash mismatch');
  });
});
