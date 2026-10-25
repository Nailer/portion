import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeFeeReview } from '../src/lib/fee-review';
afterEach(() => vi.useRealTimers());
describe('native fee review', () => {
  it('uses quoted source units and refuses an automatic higher-fee retry', async () => {
    let fee = 100n;
    const tx: any = { paymentInfo: async () => ({ partialFee: fee }) };
    const api: any = { rpc: { chain: { getFinalizedHead: async () => 'finalized', getHeader: async () => ({ number: { toNumber: () => 1000 } }) } } };
    const quote = await nativeFeeReview(api,[tx], 'public-address');
    expect(quote.review).toMatchObject({ estimatedFee: 100n, estimateThreshold: 125n, referenceBlock: 1000 });
    fee = 126n; await expect(quote.check(0)).rejects.toThrow('not raised automatically');
  });
  it('expires a quote without asking a wallet to sign', async () => {
    vi.useFakeTimers();
    const tx: any = { paymentInfo: vi.fn(async () => ({ partialFee: '100' })) };
    const api: any = { rpc: { chain: { getFinalizedHead: async () => 'hash', getHeader: async () => ({ number: { toNumber: () => 10 } }) } } };
    const quote = await nativeFeeReview(api,[tx], 'public-address');
    await vi.advanceTimersByTimeAsync(120001);
    await expect(quote.check(0)).rejects.toThrow('expired');
    expect(tx.paymentInfo).toHaveBeenCalledTimes(1);
  });
});
