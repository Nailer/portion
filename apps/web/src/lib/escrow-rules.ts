import { ASSET_CHECK_VALIDITY, type EscrowView } from '@portion/sdk';

/**
 * Which of Core v2's ongoing checks would stop the next release, mirroring the contract: the reviewer's last
 * confirmation of the asset must be under 90 days old, and after the first tranche all operator revenue must be
 * verified, with a check made since the previous release.
 */
export function releaseBlock(e: EscrowView, now: number): 'asset' | 'revenue' | null {
  if (now > e.assetCheckedAt + ASSET_CHECK_VALIDITY) return 'asset';
  if (e.nextTranche > 0 && (e.reportedRevenue === 0n || e.verifiedRevenue < e.reportedRevenue || e.revenueCheckedAt <= e.releasedAt)) return 'revenue';
  return null;
}
