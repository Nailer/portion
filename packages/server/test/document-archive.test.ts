import { describe, expect, it } from 'vitest';
import { contentHash } from '@portion/sdk';
import { restoreDocumentArchive, type DocumentArchive } from '../src/document-archive';
const contract = '0x'+'11'.repeat(20);
function archiveFixture(): DocumentArchive {
  const photo = new Uint8Array([1,2,3]); const coverHash = contentHash(photo);
  const terms = new TextEncoder().encode(JSON.stringify({v:1,assetId:777,nftCollection:9,nftItem:3,name:'Fixture',summary:'',category:0,terms:'Fixture terms',coverHash}));
  const docHash = contentHash(terms);
  return {v:1,contract,collection:9,exportedAt:new Date().toISOString(),source:'isolated fixture',catalog:[{assetId:777,docHash,createdAt:1,block:1,txHash:'fixture'}],documents:[{hash:docHash,base64:Buffer.from(terms).toString('base64')},{hash:coverHash,base64:Buffer.from(photo).toString('base64')}]};
}
describe('hash-verified document archive', () => {
  it('restores terms and photos after serialization without original service or buffers', () => {
    const source = archiveFixture(); const exported = JSON.stringify(source); const restored = restoreDocumentArchive(JSON.parse(exported),contract);
    expect(restored.documents.size).toBe(2);
    expect(contentHash(restored.documents.get(source.catalog[0].docHash)!)).toBe(source.catalog[0].docHash);
  });
  it('refuses corrupted bytes, missing photos and another deployment before returning a restore set', () => {
    const corrupt = archiveFixture(); corrupt.documents[0].base64=Buffer.from('changed').toString('base64');
    expect(()=>restoreDocumentArchive(corrupt,contract)).toThrow('inconsistent');
    const incomplete=archiveFixture(); incomplete.documents.pop(); expect(()=>restoreDocumentArchive(incomplete,contract)).toThrow('photo is missing');
    expect(()=>restoreDocumentArchive(archiveFixture(),'0x'+'22'.repeat(20))).toThrow('mismatched');
  });
});
