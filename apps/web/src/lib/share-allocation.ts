import type { ListingView } from '@portion/sdk';
export function shareAllocation(listing: ListingView, mine: number) {
  const total = listing.totalShares, available = listing.vault.forSale, staked = listing.vault.totalStaked;
  if (!Number.isSafeInteger(total) || total < 1 || !Number.isSafeInteger(mine) || mine < 0 || staked < BigInt(mine) || staked > BigInt(total) || available < 0 || !Number.isSafeInteger(available) || staked + BigInt(available) > BigInt(total)) return null;
  return { mine, otherStake: Number(staked)-mine, available, outside: total-Number(staked)-available };
}
