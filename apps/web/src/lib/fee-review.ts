import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { Prepared } from './backend';
type Tx = SubmittableExtrinsic<'promise'>;
export async function nativeFeeReview(api: ApiPromise, transactions: Tx[], address: string) {
  const hash = await api.rpc.chain.getFinalizedHead();
  const header = await api.rpc.chain.getHeader(hash);
  const fees = await Promise.all(transactions.map(async tx => BigInt((await tx.paymentInfo(address)).partialFee.toString())));
  const estimatedFee = fees.reduce((a,b) => a+b,0n);
  const observedAt = Date.now();
  const limits = fees.map(fee => (fee * 125n + 99n) / 100n);
  const review: NonNullable<Prepared['nativeReview']> = { estimatedFee, estimateThreshold: limits.reduce((a,b) => a+b,0n), observedAt, expiresAt: observedAt + 120000, source: 'Connected Portaldot RPC · paymentInfo (current state)', referenceBlock: header.number.toNumber() };
  return { review, check: async (index: number) => {
    if (Date.now() > review.expiresAt) throw new Error('The fee review expired. Start a new review before signing.');
    const fee = BigInt((await transactions[index].paymentInfo(address)).partialFee.toString());
    if (fee > limits[index]) throw new Error('The network fee exceeds your reviewed limit. Start a new review; the limit was not raised automatically.');
  } };
}
