import type { ActionResult } from './backend';
const KEY = 'portion.receipts.v1';
const HASH = /^0x[0-9a-f]{64}$/i;
export interface JournalReceipt {
  id: string; owner: string; title: string; recordedAt: number;
  status: 'finalized' | 'failed' | 'unconfirmed' | 'reconciled';
  txs: { label: string; hash: string; block?: number }[];
  warning?: string;
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
  store.setItem(KEY, JSON.stringify([row, ...readReceipts(store)].slice(0,200)));
}
export const clearReceipts = (store: Store) => store.removeItem(KEY);
export function recordReconciledOutcome(store: Store, owner: string, hash: string, block: number, ok: boolean) {
  const rows = readReceipts(store);
  for (const row of rows) {
    if (row.owner !== owner || row.status !== 'unconfirmed') continue;
    const last = row.txs.at(-1);
    if (last?.hash.toLowerCase() === hash.toLowerCase()) {
      row.status = ok ? 'reconciled' : 'failed';
      last.block = block;
    }
  }
  store.setItem(KEY, JSON.stringify(rows));
}
