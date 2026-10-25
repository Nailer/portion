import { describe, expect, it } from 'vitest';
import { readReceipts, rememberReceipt, recordReconciledOutcome } from '../src/lib/receipt-journal';
const hash = '0x' + 'ab'.repeat(32);
function storage() { const rows = new Map<string,string>(); return { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key,value); }, removeItem: (key: string) => { rows.delete(key); } }; }
describe('public receipt journal', () => {
  it('retains earlier finalized uploads when a later action fails, without inventing an overall success', () => {
    const store = storage();
    rememberReceipt(store, 'owner', 'Create asset', { ok: false, txs: [{ label: 'Terms stored', hash, block: 10 }], error: 'Later signature rejected' });
    expect(readReceipts(store)[0]).toMatchObject({ owner: 'owner', status: 'failed', txs: [{ hash, block: 10 }] });
  });
  it('preserves unknown outcomes and only reconciles the matching owner and last hash', () => {
    const store = storage(); rememberReceipt(store, 'owner', 'Purchase', { ok: false, unconfirmed: true, txHash: hash });
    recordReconciledOutcome(store, 'other', hash, 20, true);
    expect(readReceipts(store)[0].status).toBe('unconfirmed');
    recordReconciledOutcome(store, 'owner', hash, 20, true);
    expect(readReceipts(store)[0]).toMatchObject({ status: 'reconciled', txs: [{ block: 20 }] });
  });
  it('records a hashless unknown outcome but does not manufacture a receipt for a rejected connection', () => {
    const store = storage(); rememberReceipt(store, 'owner', 'Purchase', { ok: false, error: 'Rejected' });
    expect(readReceipts(store)).toEqual([]);
    rememberReceipt(store, 'owner', 'Purchase', { ok: false, unconfirmed: true });
    expect(readReceipts(store)[0]).toMatchObject({ status: 'unconfirmed', txs: [] });
  });
});
