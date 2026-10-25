const KEY = 'portion.listing-draft.v1';
export interface ListingDraft {
  name: string; summary: string; category: number; terms: string;
  totalShares: number; percentForSale: number; price: string; cadence: number;
  minPer: string; bond: string;
}
type DraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function fields(value: unknown): ListingDraft {
  const d = value as ListingDraft;
  if (!d || typeof d !== 'object') throw new Error('Invalid listing draft.');
  for (const [key, max] of [['name', 64], ['summary', 280], ['terms', 32768], ['price', 80], ['minPer', 80], ['bond', 80]] as const) {
    if (typeof d[key] !== 'string' || new TextEncoder().encode(d[key]).length > max) throw new Error(`Draft ${key} exceeds its supported size.`);
  }
  if (!Number.isInteger(d.category) || d.category < 0 || d.category > 7 || !Number.isSafeInteger(d.totalShares) || d.totalShares < 0 || d.totalShares > 1000000 ||
    !Number.isFinite(d.percentForSale) || d.percentForSale < 0 || d.percentForSale > 100 || !Number.isSafeInteger(d.cadence) || d.cadence < 60) throw new Error('Draft funding settings are invalid.');
  // Explicit allowlist: no account, key, signer, image, native identifier or receipt.
  return { name: d.name, summary: d.summary, category: d.category, terms: d.terms, totalShares: d.totalShares,
    percentForSale: d.percentForSale, price: d.price, cadence: d.cadence, minPer: d.minPer, bond: d.bond };
}
export function saveListingDraft(store: DraftStore, value: ListingDraft) {
  const draft = fields(value);
  const savedAt = Date.now();
  store.setItem(KEY, JSON.stringify({ v: 1, savedAt, draft }));
  return savedAt;
}
export function readListingDraft(store: DraftStore): { savedAt: number; draft: ListingDraft } | null {
  const raw = store.getItem(KEY);
  if (!raw) return null;
  if (raw.length > 50000) throw new Error('Saved draft is too large.');
  const value = JSON.parse(raw);
  if (value.v !== 1 || !Number.isSafeInteger(value.savedAt) || value.savedAt < 0) throw new Error('Saved draft format is unsupported.');
  return { savedAt: value.savedAt, draft: fields(value.draft) };
}
export const clearListingDraft = (store: DraftStore) => store.removeItem(KEY);
