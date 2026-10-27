import type { CSSProperties } from 'react';
const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6', external: 'M7 17 17 7M7 7h10v10', close: 'm6 6 12 12M6 18 18 6',
  shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-6',
  wallet: 'M20 8H5a2 2 0 0 1 0-4h13v4m2 0v12H5a2 2 0 0 1-2-2V6m17 6h-5v4h5',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7l1-7Z',
  layers: 'm12 3 10 6-10 6L2 9l10-6Zm-10 9 10 6 10-6M2 16l10 6 10-6',
  building: 'M5 21V5l7-3v19M12 8h7v13M2 21h20M8 7v2m0 3v2m0 3v2m8-7v2m0 3v2',
  check: 'm5 12 4 4L19 6', search: 'M21 21l-5-5m2-6a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 4v3',
} as const;
export function Icon({ name, size = 20, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]}/></svg>;
}
export function BrandMark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 2 34 10 28 14 20 9 12 14 6 10 20 2Z" fill="#2250d6"/><path d="M36 13v16l-14 8v-8l7-4v-8l7-4Z" fill="#1b9bc0"/><path d="M18 37 4 29V13l7 4v8l7 4v8Z" fill="#8fb0f0"/><path d="m20 15 5 3v5l-5 3-5-3v-5l5-3Z" fill="#0c1f44"/></svg>;
}
