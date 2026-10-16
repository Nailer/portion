import { formatUnits as ethFormat, parseUnits as ethParse } from 'ethers';
import { POT_DECIMALS, PUSD_DECIMALS } from './constants';

export function formatUnits(v: bigint | string | number, decimals: number, maxFrac = 2): string {
  const s = ethFormat(BigInt(v), decimals);
  const [i, f = ''] = s.split('.');
  const frac = f.slice(0, maxFrac).replace(/0+$/, '');
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${int}.${frac}` : int;
}

export const parseUnits = (v: string, decimals: number): bigint => ethParse(v || '0', decimals);

export const fmtPot = (v: bigint | string | number, maxFrac = 3) => `${formatUnits(v, POT_DECIMALS, maxFrac)} tPOT`;
export const fmtPusd = (v: bigint | string | number, maxFrac = 2) => `${formatUnits(v, PUSD_DECIMALS, maxFrac)} pUSD`;

export function fmtDuration(seconds: number): string {
  if (seconds >= 86_400 * 2) return `${Math.round(seconds / 86_400)} days`;
  if (seconds >= 3_600 * 2) return `${Math.round(seconds / 3_600)} hours`;
  if (seconds >= 120) return `${Math.round(seconds / 60)} min`;
  return `${seconds}s`;
}
