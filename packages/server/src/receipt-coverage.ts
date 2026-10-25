export interface StoredReceipt {
  block: number; ts: number; txHash: string;
  rows: { kind: string; listingId: number; actor: string | null; data: Record<string, unknown> }[];
}

export function revenueCoverage(receipts: StoredReceipt[], id: number, total: bigint, finalizedBlock: number) {
  const included = receipts.filter(receipt => receipt.block <= finalizedBlock);
  let published = 0n;
  for (const receipt of included) for (const row of receipt.rows) {
    if (row.listingId !== id || !['RevenueDeposited', 'Slashed'].includes(row.kind)) continue;
    const amount = row.kind === 'RevenueDeposited' ? row.data.net : row.data.toHolders ?? row.data.holders;
    if (!/^\d+$/.test(String(amount))) throw new Error('Receipt allocation amount is unavailable.');
    published += BigInt(String(amount));
  }
  return { coverage: 'partial' as const, indexedHistoryComplete: false,
    finalizedBlock, contractTotal: total.toString(), publishedTotal: published.toString(),
    missingAllocation: published <= total ? (total - published).toString() : null,
    totalsMatch: published === total, inconsistent: published > total,
    note: 'Matching allocation totals do not establish complete transaction history. Outside receipts may be missing.' };
}
