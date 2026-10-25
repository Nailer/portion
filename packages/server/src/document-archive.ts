import { contentHash, coreDocument, MAX_DOC_BYTES, type CoreRecord } from '@portion/sdk';

export interface DocumentArchive {
  v: 1; contract: string; collection: number; exportedAt: string; source: string;
  catalog: CoreRecord[]; documents: { hash: string; base64: string }[];
}
/** Verify every byte before exposing any restored document. Anchors are not renewed. */
export function restoreDocumentArchive(input: unknown, expectedContract: string) {
  const archive = input as DocumentArchive;
  if (!archive || archive.v !== 1 || archive.contract?.toLowerCase() !== expectedContract.toLowerCase() || !Number.isSafeInteger(archive.collection) || !Array.isArray(archive.catalog) || !Array.isArray(archive.documents) || archive.documents.length > 200 || archive.catalog.length > 100 || !Number.isFinite(Date.parse(archive.exportedAt))) throw new Error('Unsupported or mismatched document archive.');
  const documents = new Map<string,Uint8Array>();
  for (const entry of archive.documents) {
    if (!entry || !/^0x[0-9a-f]{64}$/i.test(entry.hash) || typeof entry.base64 !== 'string' || entry.base64.length > 44000) throw new Error('Archive entry is invalid.');
    const bytes = new Uint8Array(Buffer.from(entry.base64,'base64'));
    if (Buffer.from(bytes).toString('base64') !== entry.base64 || bytes.length > MAX_DOC_BYTES || contentHash(bytes).toLowerCase() !== entry.hash.toLowerCase() || documents.has(entry.hash.toLowerCase())) throw new Error('Archive content hash or size is inconsistent.');
    documents.set(entry.hash.toLowerCase(),bytes);
  }
  for (const row of archive.catalog) {
    if (!Number.isSafeInteger(row.assetId) || !/^0x[0-9a-f]{64}$/i.test(row.docHash)) throw new Error('Archive catalog identity is invalid.');
    const bytes = documents.get(row.docHash.toLowerCase()); if (!bytes) throw new Error('Archive terms are missing.');
    const doc = coreDocument(JSON.parse(new TextDecoder().decode(bytes)),row.assetId,archive.collection);
    if (!documents.has(doc.coverHash.toLowerCase())) throw new Error('Archive photo is missing.');
  }
  return { archive, documents };
}
