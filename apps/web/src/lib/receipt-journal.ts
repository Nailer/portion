import type { ActionResult } from './backend';
const KEY = 'portion.receipts.v1';
const HASH = /^0x[0-9a-f]{64}$/i;
export interface JournalReceipt {
  id: string; owner: string; title: string; recordedAt: number;
  status: 'finalized' | 'failed' | 'unconfirmed' | 'reconciled';
  txs: { label: string; hash: string; block?: number }[];
  warning?: string;
  callHash?: string;
  nonce?: string;
}
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function readReceipts(store: Store): JournalReceipt[] {
  const raw = store.getItem(KEY); if (!raw) return [];
  if (raw.length > 500000) throw new Error('Local receipt file exceeds its supported size.');
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length > 200 || rows.some(row => !row || typeof row.id !== 'string' || typeof row.owner !== 'string' || typeof row.title !== 'string' || !Number.isSafeInteger(row.recordedAt) || !['finalized','failed','unconfirmed','reconciled'].includes(row.status) || !Array.isArray(row.txs) || row.txs.some((tx: any) => !HASH.test(tx.hash) || typeof tx.label !== 'string' || (tx.block !== undefined && (!Number.isSafeInteger(tx.block) || tx.block < 1))))) throw new Error('Local receipt data is invalid.');
  return rows;
}
export function rememberReceipt(store: Store, owner: string, title: string, result: ActionResult) {
  const txs = [...(result.txs ?? [])];
  if (result.txHash && !txs.some(tx => tx.hash === result.txHash)) txs.push({ label: 'Transaction', hash: result.txHash, block: result.blockNumber });
  const valid = txs.filter(tx => HASH.test(tx.hash));
  if (!valid.length && !result.unconfirmed) return;
  const row: JournalReceipt = { id: crypto.randomUUID(), owner, title: title.slice(0,200), recordedAt: Date.now(),
    status: result.unconfirmed ? 'unconfirmed' : result.ok ? 'finalized' : 'failed',
    txs: valid.map(tx => ({ label: tx.label.slice(0,100), hash: tx.hash, ...(tx.block ? { block: tx.block } : {}) })),
    ...(result.warning ? { warning: result.warning.slice(0,1000) } : {}) };
  const all = [row, ...readReceipts(store)];
  const unresolved = all.filter(receipt => receipt.status === 'unconfirmed');
  if (unresolved.length > 200) throw new Error('Too many unresolved receipts. Reconcile them before submitting more actions.');
  const retained = [...unresolved,...all.filter(receipt => receipt.status !== 'unconfirmed').slice(0,200-unresolved.length)].sort((a,b) => b.recordedAt-a.recordedAt);
  store.setItem(KEY, JSON.stringify(retained));
}
export const clearReceipts = (store: Store) => store.removeItem(KEY);
export function recordReconciledOutcome(store: Store, owner: string, hash: string, block: number, ok: boolean, metadata?: { callHash: string; nonce: string }) {
  const rows = readReceipts(store);
  for (const row of rows) {
    if (row.owner !== owner || row.status !== 'unconfirmed') continue;
    const last = row.txs.at(-1);
    if (last?.hash.toLowerCase() === hash.toLowerCase() || metadata && row.callHash?.toLowerCase() === metadata.callHash.toLowerCase() && row.nonce === metadata.nonce) {
      row.status = ok ? 'reconciled' : 'failed';
      if (last?.hash.toLowerCase() === hash.toLowerCase()) last.block = block;
      else row.txs.push({label:'Verified transaction',hash,block});
    }
  }
  store.setItem(KEY, JSON.stringify(rows));
}
export function reserveLocalReceipt(store: Store, owner: string, title: string, callHash: string, nonce: string) {
  if (!HASH.test(callHash) || !/^\d+$/.test(nonce)) throw new Error('Submission identity is invalid.');
  const rows = readReceipts(store);
  if (rows.filter(row => row.status==='unconfirmed').length >= 190 || rows.some(row=>row.owner===owner && row.title===title && row.status==='unconfirmed')) throw new Error('An earlier outcome must be reconciled before this action can be submitted.');
  const id = crypto.randomUUID();
  const row: JournalReceipt = {id,owner,title:title.slice(0,200),recordedAt:Date.now(),status:'unconfirmed',txs:[],callHash,nonce};
  const unsettled = rows.filter(row=>row.status==='unconfirmed');
  store.setItem(KEY,JSON.stringify([row,...unsettled,...rows.filter(row=>row.status!=='unconfirmed').slice(0,199-unsettled.length)]));
  return id;
}
export function settleLocalReceipt(store: Store, id: string, result: ActionResult) {
  const rows = readReceipts(store); const row = rows.find(row=>row.id===id);
  if (!row) throw new Error('Submission receipt is missing; reconcile before retrying.');
  row.status = result.unconfirmed ? 'unconfirmed' : result.ok ? 'finalized' : 'failed';
  if (result.txHash && HASH.test(result.txHash)) row.txs = [{label:'Transaction',hash:result.txHash,...(result.blockNumber?{block:result.blockNumber}:{})}];
  if (result.warning) row.warning=result.warning.slice(0,1000);
  store.setItem(KEY,JSON.stringify(rows));
}
