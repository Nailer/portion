const PREFIX = 'portion.upload.v1:';
const HASH = /^0x[0-9a-f]{64}$/i;
export interface UploadReceipt { txHash: string; blockHash: string; blockNumber?: number }
export interface UploadCheckpoint {
  v: 1; fingerprint: string; owner: string; contract: string; assetId: number; nftItem: number;
  documents: Partial<Record<'Terms' | 'Photo', UploadReceipt>>;
  creation?: UploadReceipt;
  pending?: { stage: 'Terms' | 'Photo' | 'Creation'; callHash: string; nonce: string; txHash?: string };
}
function valid(value: unknown): UploadCheckpoint {
  const c = value as UploadCheckpoint;
  const receipt = (r: UploadReceipt) => r && HASH.test(r.txHash) && HASH.test(r.blockHash) && (r.blockNumber === undefined || Number.isSafeInteger(r.blockNumber) && r.blockNumber > 0);
  if (!c || c.v !== 1 || !HASH.test(c.fingerprint) || typeof c.owner !== 'string' || !/^0x[0-9a-f]{40}$/i.test(c.contract) || !Number.isSafeInteger(c.assetId) || c.assetId < 0 || !Number.isSafeInteger(c.nftItem) || c.nftItem < 0 || !c.documents || Object.entries(c.documents).some(([key,r]) => !['Terms','Photo'].includes(key) || !receipt(r)) || (c.creation && !receipt(c.creation)) || (c.pending && (!['Terms','Photo','Creation'].includes(c.pending.stage) || !HASH.test(c.pending.callHash) || !/^\d+$/.test(c.pending.nonce) || c.pending.txHash !== undefined && !HASH.test(c.pending.txHash)))) throw new Error('Upload recovery data is invalid. Do not submit again until its receipts are checked.');
  return c;
}
export function loadUpload(store: Storage, fingerprint: string) {
  const raw = store.getItem(PREFIX + fingerprint);
  if (!raw) return null;
  if (raw.length > 10000) throw new Error('Upload recovery data is too large.');
  const c = valid(JSON.parse(raw));
  if (c.fingerprint !== fingerprint) throw new Error('Upload recovery identity differs.');
  return c;
}
export function saveUpload(store: Storage, checkpoint: UploadCheckpoint) {
  const c = valid(checkpoint);
  const receipt = (r: UploadReceipt) => ({ txHash: r.txHash, blockHash: r.blockHash, ...(r.blockNumber ? { blockNumber: r.blockNumber } : {}) });
  // Only public identifiers, receipts and transaction metadata; no photo or signing key.
  store.setItem(PREFIX + c.fingerprint, JSON.stringify({ v: 1, fingerprint: c.fingerprint, owner: c.owner, contract: c.contract,
    assetId: c.assetId, nftItem: c.nftItem, documents: Object.fromEntries(Object.entries(c.documents).map(([key,r]) => [key,receipt(r)])), ...(c.creation ? { creation: receipt(c.creation) } : {}),
    ...(c.pending ? { pending: { stage: c.pending.stage, callHash: c.pending.callHash, nonce: c.pending.nonce, ...(c.pending.txHash ? { txHash: c.pending.txHash } : {}) } } : {}) }));
}
export function reconcileUploads(store: Storage, outcome: { signer: string; txHash: string; blockHash: string; blockNumber: number; callHash: string; nonce: string; ok: boolean }) {
  let changed = 0;
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i); if (!key?.startsWith(PREFIX)) continue;
    const c = loadUpload(store, key.slice(PREFIX.length)); const p = c?.pending;
    if (!c || !p || c.owner !== outcome.signer || p.nonce !== outcome.nonce || p.callHash.toLowerCase() !== outcome.callHash.toLowerCase() || p.txHash && p.txHash.toLowerCase() !== outcome.txHash.toLowerCase()) continue;
    if (outcome.ok) {
      const receipt = { txHash: outcome.txHash, blockHash: outcome.blockHash, blockNumber: outcome.blockNumber };
      if (p.stage === 'Creation') c.creation = receipt; else c.documents[p.stage] = receipt;
    }
    delete c.pending; saveUpload(store,c); changed++;
  }
  return changed;
}
