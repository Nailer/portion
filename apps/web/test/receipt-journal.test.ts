import { describe, expect, it } from 'vitest';
import { readReceipts, rememberReceipt, recordReconciledOutcome, reserveLocalReceipt, settleLocalReceipt } from '../src/lib/receipt-journal';
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
  it('survives a refresh before a hash is returned and rejects a duplicate action until exact call/nonce reconciliation', () => {
    const store = storage(); const id = reserveLocalReceipt(store,'owner','Purchase',hash,'7');
    expect(readReceipts(store)[0]).toMatchObject({id,status:'unconfirmed',txs:[],callHash:hash,nonce:'7'});
    expect(()=>reserveLocalReceipt(store,'owner','Purchase',hash,'8')).toThrow('earlier outcome');
    recordReconciledOutcome(store,'owner','0x'+'cd'.repeat(32),20,true,{callHash:hash,nonce:'6'});
    expect(readReceipts(store)[0].status).toBe('unconfirmed');
    recordReconciledOutcome(store,'owner','0x'+'cd'.repeat(32),20,true,{callHash:hash,nonce:'7'});
    expect(readReceipts(store)[0].status).toBe('reconciled');
  });
  it('settles a declined request without inventing a finalized transaction', () => {
    const store = storage(); const id = reserveLocalReceipt(store,'owner','Purchase',hash,'7');
    settleLocalReceipt(store,id,{ok:false,error:'Wallet rejected'});
    expect(readReceipts(store)[0]).toMatchObject({status:'failed',txs:[]});
  });
});
