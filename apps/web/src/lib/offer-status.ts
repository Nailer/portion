import type { ListingView } from '@portion/sdk';
import { RECORDED } from './evidence';

export type OfferKey = 'open' | 'sold-out' | 'closed' | 'blocked' | 'wound-down' | 'awaiting-review' | 'deadline-passed' | 'refunding' | 'funded';
export interface OfferStatus { key: OfferKey; label: string; detail: string; canBuy: boolean }

/** One meaning per word: each state a listing's offer can be in, read only from contract fields. */
export function offerStatus(l: Pick<ListingView, 'saleOpen' | 'health' | 'totalShares' | 'escrow' | 'vault'>): OfferStatus {
  const { forSale, sold } = l.vault;
  const phase = l.escrow?.phase;
  if (phase === 'Refunding') return { key: 'refunding', label: 'Refunds open', detail: 'This raise ended early. Buyers can take back their share of the money the operator never received.', canBuy: false };
  if (l.health === 'WoundDown') return { key: 'wound-down', label: 'Wound down', detail: 'The operator closed this listing. Income already allocated stays claimable by its holders.', canBuy: false };
  if (phase === 'Pending') return { key: 'awaiting-review', label: 'Awaiting review', detail: 'The named reviewer must attest before anyone can buy.', canBuy: false };
  if (phase === 'Funding' && !l.saleOpen) return forSale === 0
    ? { key: 'sold-out', label: 'Sold out', detail: 'Every offered share was bought, so the target is met. Anyone can now settle the raise to activate the listing.', canBuy: false }
    : { key: 'deadline-passed', label: 'Deadline passed', detail: 'The funding deadline has passed. Anyone can now settle the raise: it either activates or opens full refunds.', canBuy: false };
  if (phase === 'Active') return { key: 'funded', label: 'Funded', detail: 'The raise met its target, so no more shares are on offer. Money is released in reviewer-approved tranches.', canBuy: false };
  if (l.health === 'Defaulted') return { key: 'blocked', label: 'Funding unavailable', detail: 'Two payment periods passed without a qualifying deposit, so new purchases are blocked.', canBuy: false };
  if (l.saleOpen && forSale > 0) return { key: 'open', label: `${forSale.toLocaleString()} available`, detail: 'This offer is open for purchase.', canBuy: true };
  if (sold === l.totalShares || (l.saleOpen && forSale === 0)) return { key: 'sold-out', label: 'Sold out', detail: 'Every offered share was bought. This offer cannot take another purchase.', canBuy: false };
  return { key: 'closed', label: 'Sale closed', detail: 'The operator closed the sale before every share was bought.', canBuy: false };
}

/** Disclosed protocol tests that represent no equipment, ownership or revenue. */
export const isDevelopmentTest = (id: number) => id === RECORDED.listing.assetId;
