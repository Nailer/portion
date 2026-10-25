import { describe, expect, it } from 'vitest';
import { contentHash } from '@portion/sdk';
import { verifiedPhoto } from '../src/lib/photo-verification';
describe('independent photo-byte verification',()=>{
  it('accepts recorded PNG bytes and rejects a substituted photo independently of terms',async()=>{
    const bytes=new Uint8Array([137,80,78,71,13,10,26,10,0]);const hash=contentHash(bytes);
    expect(await verifiedPhoto(bytes,hash)).toBe('image/png');
    await expect(verifiedPhoto(new Uint8Array([...bytes,1]),hash)).rejects.toThrow('recorded hash');
  });
  it('does not render verified text or active vector content as an asset photograph',async()=>{
    const bytes=new TextEncoder().encode('<svg>fixture</svg>');
    await expect(verifiedPhoto(bytes,contentHash(bytes))).rejects.toThrow('supported image');
  });
});
