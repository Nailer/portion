import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { contentHash, coreDocument, MAX_DOC_BYTES, type CoreRecord, type Deployment } from '@portion/sdk';
import { restoreDocumentArchive, type DocumentArchive } from '../packages/server/src/document-archive.js';

// Public GET requests only. No dotenv, signing account, Blob token or cloud CLI.
const deployment = JSON.parse(await readFile(new URL('../deployments/portaldot-testnet.json',import.meta.url),'utf8')) as Deployment;
const args = process.argv.slice(2);
if (args[0] === '--verify') {
  if (!args[1]) throw new Error('Supply the archive JSON path after --verify.');
  const raw = await readFile(resolve(args[1]),'utf8');
  if (raw.length > 16000000) throw new Error('Archive exceeds its supported size.');
  const {archive,documents} = restoreDocumentArchive(JSON.parse(raw),deployment.portion);
  console.log(JSON.stringify({verified:true,contract:archive.contract,listings:archive.catalog.length,documents:documents.size,exportedAt:archive.exportedAt,scope:'Verified bytes restored in a fresh process; no provider write or retention renewal.'},null,2));
} else {
  const source = 'https://portion-one.vercel.app';
  const json = async <T>(path: string): Promise<T> => { const response = await fetch(source+path,{signal:AbortSignal.timeout(30000)}); if(!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response.json() as Promise<T>; };
  const hosted = await json<Deployment>('/api/deployment');
  if(hosted.portion.toLowerCase()!==deployment.portion.toLowerCase() || hosted.contractVersion!=='core-v1') throw new Error('Hosted deployment differs from this project.');
  const catalog = await json<CoreRecord[]>('/api/catalog');
  if(!Array.isArray(catalog) || catalog.length>100) throw new Error('Catalog exceeds this backup command budget; use an incremental archive before proceeding.');
  const documents = new Map<string,Uint8Array>();
  const fetchDoc = async (hash: string) => {
    if(documents.has(hash.toLowerCase())) return documents.get(hash.toLowerCase())!;
    if(!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Invalid public document hash.');
    const response = await fetch(source+'/api/doc/'+hash,{signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`Document unavailable: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if(bytes.length>MAX_DOC_BYTES || contentHash(bytes).toLowerCase()!==hash.toLowerCase()) throw new Error('Public document hash mismatch.');
    documents.set(hash.toLowerCase(),bytes); return bytes;
  };
  for(const row of catalog) { const bytes = await fetchDoc(row.docHash); const doc = coreDocument(JSON.parse(new TextDecoder().decode(bytes)),row.assetId,deployment.deedsCollection); await fetchDoc(doc.coverHash); }
  const archive: DocumentArchive = {v:1,contract:deployment.portion,collection:deployment.deedsCollection,source,exportedAt:new Date().toISOString(),catalog,documents:[...documents].map(([hash,bytes])=>({hash,base64:Buffer.from(bytes).toString('base64')}))};
  restoreDocumentArchive(archive,deployment.portion);
  const path = resolve(args[0] ?? `backups/public-documents-${new Date().toISOString().replaceAll(':','-')}.json`);
  await mkdir(dirname(path),{recursive:true,mode:0o700});
  await writeFile(path,JSON.stringify(archive,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({path,listings:catalog.length,documents:documents.size,verified:true,scope:'Public documents only; no chain writes, secrets, complete history or live provider restore.'},null,2));
}
