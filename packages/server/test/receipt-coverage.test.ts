import { describe, expect, it } from 'vitest';
import { revenueCoverage, type StoredReceipt } from '../src/receipt-coverage';
const receipt = (kind: string, data: Record<string, unknown>, block = 10): StoredReceipt => ({ block, ts: 1, txHash: 'fixture', rows: [{ kind, listingId: 777, actor: null, data }] });
describe('partial receipt reconciliation', () => {
  it('detects allocations whose outside receipts were never published', () => {
    expect(revenueCoverage([receipt('RevenueDeposited', { net: '100' })], 777, 300n, 10)).toMatchObject({ publishedTotal: '100', contractTotal: '300', missingAllocation: '200', totalsMatch: false, indexedHistoryComplete: false });
  });
  it('counts net revenue and holder bond allocation, excludes claims and later blocks', () => {
    const rows = [receipt('RevenueDeposited', { net: '100' }), receipt('Slashed', { holders: '20' }), receipt('Claimed', { amount: '120' }), receipt('RevenueDeposited', { net: '5' }, 11)];
    expect(revenueCoverage(rows, 777, 120n, 10)).toMatchObject({ publishedTotal: '120', totalsMatch: true, coverage: 'partial', indexedHistoryComplete: false });
  });
  it('does not convert malformed records or an inconsistent total into zero income', () => {
    expect(() => revenueCoverage([receipt('RevenueDeposited', {})], 777, 100n, 10)).toThrow('unavailable');
    expect(revenueCoverage([receipt('Slashed', { holders: '101' })], 777, 100n, 10)).toMatchObject({ inconsistent: true, missingAllocation: null });
  });
});
