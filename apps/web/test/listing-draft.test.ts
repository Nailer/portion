import { describe, expect, it } from 'vitest';
import { saveListingDraft, readListingDraft, clearListingDraft } from '../src/lib/listing-draft';
function storage() { const rows = new Map<string, string>(); return { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); }, rows }; }
const draft = { name: 'Actual business', summary: '', category: 0, terms: '', totalShares: 0, percentForSale: 0, price: '', cadence: 604800, minPer: '', bond: '' };
describe('unsigned local listing drafts', () => {
  it('round-trips incomplete business fields and drops credentials, photos and chain identifiers', () => {
    const store = storage();
    saveListingDraft(store, { ...draft, mnemonic: 'never persist', image: 'photo', assetId: 123, signer: 'secret' } as any);
    expect(readListingDraft(store)?.draft).toEqual(draft);
    expect([...store.rows.values()].join('')).not.toMatch(/never persist|photo|assetId|signer/);
    clearListingDraft(store); expect(readListingDraft(store)).toBeNull();
  });
  it('rejects corrupt, oversized or invalid settings without overwriting an existing draft', () => {
    const store = storage(); saveListingDraft(store, draft);
    expect(() => saveListingDraft(store, { ...draft, totalShares: -1 })).toThrow('invalid');
    expect(() => saveListingDraft(store, { ...draft, terms: 'x'.repeat(32769) })).toThrow('size');
    expect(readListingDraft(store)?.draft).toEqual(draft);
    store.setItem('portion.listing-draft.v1', '{bad'); expect(() => readListingDraft(store)).toThrow();
  });
});
