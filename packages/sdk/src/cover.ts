import { CATEGORIES } from './constants';

const PALETTES: [string, string, string][] = [
  ['#f5b301', '#0e2a22', '#fff3c4'], // energy
  ['#2f9e8f', '#0e2a22', '#c9f2ea'], // mobility
  ['#7bb661', '#10281c', '#e3f4d4'], // food & agriculture
  ['#e4572e', '#2a1410', '#ffd9cc'], // retail & kiosks
  ['#3d6fd6', '#0d1b3a', '#d6e2ff'], // equipment
  ['#b08968', '#2b1d12', '#f1e2d3'], // real estate
  ['#8e5bd6', '#1f1236', '#e9dcff'], // media & IP
  ['#6b7f78', '#10211d', '#e1e9e5'], // other
];

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wedge = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`;
};

/**
 * Generates a small SVG emblem for a listing that has no photo: a cut disc whose wedge count and angle come from the
 * name, so every listing gets a recognisable mark. Deterministic, about 1.5 KB, safe to store on-chain.
 */
export function generateCover(name: string, category: number): string {
  const [accent, ink, tint] = PALETTES[category % PALETTES.length];
  const r = rng(`${name}:${category}`);
  const cx = 200;
  const cy = 150;
  const slices = 5 + Math.floor(r() * 4);
  const start = r() * Math.PI * 2;
  const taken = 1 + Math.floor(r() * (slices - 2));
  let paths = '';
  for (let i = 0; i < slices; i++) {
    const a0 = start + (i / slices) * Math.PI * 2;
    const a1 = start + ((i + 1) / slices) * Math.PI * 2 - 0.035;
    const lifted = i < taken;
    const dx = lifted ? Math.cos((a0 + a1) / 2) * 14 : 0;
    const dy = lifted ? Math.sin((a0 + a1) / 2) * 14 : 0;
    paths += `<path d="${wedge(cx + dx, cy + dy, 96, a0, a1)}" fill="${lifted ? accent : tint}" opacity="${lifted ? 1 : 0.9 - i * 0.04}"/>`;
  }
  const label = (CATEGORIES[category % CATEGORIES.length] ?? 'Other').replace(/&/g, '&amp;');
  const bars = Array.from({ length: 4 }, (_, i) => `<rect x="${24 + i * 14}" y="${248 - (12 + r() * 40)}" width="8" height="${12 + r() * 40}" fill="${accent}" opacity="${0.35 + i * 0.15}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${ink}"/><circle cx="${cx}" cy="${cy}" r="132" fill="none" stroke="${accent}" stroke-opacity=".25" stroke-width="1.5"/>${paths}${bars}<text x="376" y="278" text-anchor="end" font-family="sans-serif" font-size="13" fill="${tint}" opacity=".7">${label}</text></svg>`;
}
