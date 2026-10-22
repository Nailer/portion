import { CATEGORIES } from './constants';

const PALETTES = ['#6b9dff', '#74d8e7', '#89b4ef', '#ffa877', '#a1a4ff', '#a4d7df', '#ba9cff', '#7ca4d8'];

/** Original, deterministic category illustrations. No user text or external URLs enter the SVG. */
export function generateCover(name: string, category: number): string {
  const index = Number.isInteger(category) && category >= 0 ? category % PALETTES.length : 7;
  const accent = PALETTES[index];
  let seed = 0;
  for (const c of name) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  const shift = seed % 10;
  const label = (CATEGORIES[index] ?? 'Other').replace(/&/g, '&amp;');
  const platform = `<ellipse cx="200" cy="229" rx="123" ry="24" fill="#020915" opacity=".6"/><path d="m75 203 125-63 125 63-125 66z" fill="#102442" stroke="#2d507a"/><path d="m75 203 125 66 125-66v12l-125 65-125-65z" fill="#0b182d"/>`;
  let illustration: string;
  if (index === 0) {
    illustration = `<path d="M130 179v44m140-44v44" stroke="#466b99" stroke-width="6"/><path d="m101 141 99-50 100 50-100 54z" fill="#183b6a" stroke="${accent}" stroke-width="2"/><path d="m101 141 99 54 100-54v8l-100 54-99-54z" fill="#345a8b"/><g stroke="${accent}" stroke-opacity=".55"><path d="m120 131 100 54m-80-64 100 54m-80-64 100 54m-80-64 100 54m-160 0 99-51m-79 62 99-51m-79 62 99-51"/></g><circle cx="290" cy="70" r="19" fill="${accent}" opacity=".15"/><circle cx="290" cy="70" r="10" fill="${accent}"/>`;
  } else if (index === 1) {
    illustration = `<g stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="135" cy="183" r="37" fill="#0c1c33"/><circle cx="265" cy="183" r="37" fill="#0c1c33"/><path d="m135 183 41-64 29 64h-70Zm70 0 39-64 21 64m-89-64h68m-73-9h22m46 9-7-20h20" fill="none"/><path d="m184 135 31 14-10 34-31-14z" fill="#315c83" stroke-width="2"/></g>`;
  } else if (index === 2 || index === 4 || index === 5) {
    illustration = `<path d="m110 127 90-46 90 46v87l-90 47-90-47z" fill="#153159" stroke="#4774a7"/><path d="m110 127 90 48 90-48-90-46z" fill="#315883"/><path d="M200 175v86l90-47v-87z" fill="#0d2445"/><path d="m133 160 43 22v57l-43-22z" fill="#0a182c" stroke="#4b719b"/><path d="m219 185 46-24v43l-46 24z" fill="#244d7b"/><g stroke="${accent}" stroke-width="2"><path d="M150 133v-28m-12 7 24 14m-24 0 24-14"/><path d="m230 133 34-18m-34 26 34-18"/></g>`;
  } else {
    const bars = Array.from({length: 11},(_,i) => { const height = 30 + ((i * 23 + seed) % 90); return `<rect x="${105+i*17}" y="${155-height/2}" width="7" height="${height}" rx="3.5" fill="${accent}" opacity="${.35+(i%4)*.17}"/>`; }).join('');
    illustration = `<ellipse cx="200" cy="150" rx="112" ry="65" fill="#122b50" stroke="#345980"/>${bars}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><radialGradient id="a"><stop stop-color="${accent}" stop-opacity=".2"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="400" height="300" fill="#0e1c31"/><ellipse cx="${200+shift}" cy="130" rx="185" ry="145" fill="url(#a)"/><g transform="translate(0 ${shift-5})">${platform}${illustration}</g><text x="22" y="280" font-family="sans-serif" font-size="10" letter-spacing="2" fill="#7899c2">${label.toUpperCase()}</text><path d="M347 271h30m-8-6 8 6-8 6" stroke="${accent}" stroke-width="1.5" fill="none"/></svg>`;
}
