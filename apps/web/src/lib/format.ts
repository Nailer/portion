import { formatUnits, type ListingView } from '@portion/sdk';

const big = (v: bigint | number | string): bigint => (typeof v === 'number' ? BigInt(Math.round(v)) : BigInt(v));
export const usd = (v: bigint | number | string | null, frac = 2) => v === null ? 'Unavailable' : `${formatUnits(big(v), 6, frac)} pUSD`;
export const pot = (v: bigint | number | string, frac = 2) => `${formatUnits(big(v), 14, frac)} tPOT`;
export const num = (v: number) => v.toLocaleString('en-US');

export function ago(ts: number, now = Math.floor(Date.now() / 1000)): string {
  const s = Math.max(0, now - ts);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

export function span(seconds: number): string {
  const s = Math.abs(seconds);
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  if (s < 86_400 * 2) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} days`;
}

export function cadenceLabel(sec: number): string {
  if (sec <= 600) return `every ${Math.round(sec / 60)} min`;
  if (sec === 86_400) return 'daily';
  if (sec === 604_800) return 'weekly';
  if (sec === 2_592_000) return 'monthly';
  return `every ${span(sec)}`;
}

/** What the operator promised, in numbers an investor can compare. */
export function economics(l: ListingView) {
  const price = Number(l.vault.salePrice) / 1e6;
  const raise = price * l.totalShares;
  const perShareFloor = Number(l.minPerPeriod) / 1e6 / l.totalShares;
  const paid = Number(l.vault.totalRevenue) / 1e6;
  const soldPct = l.vault.sold + l.vault.forSale > 0 ? l.vault.sold / (l.vault.sold + l.vault.forSale) : 0;
  return { price, raise, perShareFloor, paid, soldPct };
}

export function short(a: string, h = 6, t = 4) {
  return a.length <= h + t + 1 ? a : `${a.slice(0, h)}…${a.slice(-t)}`;
}

export const explorerBlock = (n?: number) =>
  `https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer/query/${n ?? ''}`;
