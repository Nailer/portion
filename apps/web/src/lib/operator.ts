import { parseUnits, type ListingView } from '@portion/sdk';
import type { TokenizeForm } from './backend';

export const DEMO_SOLAR: TokenizeForm = {
  name: 'Solar neighbourhood hub', summary: 'A simulated solar installation supplying daytime power to local businesses.', category: 0,
  totalShares: 100, sharesForSale: 100, pricePusd: '10', cadenceSeconds: 604800, minPerPeriodPusd: '20', bondPusd: '50',
  terms: 'Simulation only. The operator deposits at least 20 pUSD weekly. Revenue comes from customer electricity payments. The bond provides limited compensation for missed deposits; purchase principal is not guaranteed or automatically redeemed.', image: null,
};

export function paymentPreview(amount: string, minimum: bigint, feeBps: number) {
  try {
    const gross = parseUnits(amount, 6);
    if (gross <= 0n) return null;
    const fee = gross * BigInt(feeBps) / 10000n;
    return { gross, fee, net: gross - fee, qualifying: gross >= minimum };
  } catch { return null; }
}

export function operatorSummary(listings: ListingView[], saleFeeBps: number) {
  const gross = listings.reduce((n, l) => n + BigInt(l.vault.sold) * l.vault.salePrice, 0n);
  return {
    gross, netEstimate: gross - gross * BigInt(saleFeeBps) / 10000n,
    bonds: listings.reduce((n, l) => n + l.vault.bond, 0n),
    distributed: listings.reduce((n, l) => n + l.vault.totalRevenue, 0n),
    needsAttention: listings.filter(l => l.health === 'Late' || l.health === 'Defaulted').length,
    active: listings.filter(l => l.health !== 'WoundDown').length,
  };
}
