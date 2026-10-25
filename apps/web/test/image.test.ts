import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from '../src/lib/image';
afterEach(()=>vi.unstubAllGlobals());
describe('public asset photo bounds',()=>{
  it('rejects unsupported or oversized input before decoding it',async()=>{
    const decode=vi.fn();vi.stubGlobal('createImageBitmap',decode);
    await expect(compressImage(new File(['svg'],'image.svg',{type:'image/svg+xml'}))).rejects.toThrow('JPEG');
    await expect(compressImage(new File([new Uint8Array(10*1024*1024+1)],'huge.jpg',{type:'image/jpeg'}))).rejects.toThrow('10 MB');
    expect(decode).not.toHaveBeenCalled();
  });
  it('bounds both portrait dimensions, retains a clear quality setting and closes the decoded bitmap',async()=>{
    const close=vi.fn(),drawImage=vi.fn(); const canvas:any={getContext:()=>({fillStyle:'',fillRect:vi.fn(),drawImage}),toBlob:(resolve:any,mime:string)=>resolve(new Blob(['thumbnail'],{type:mime}))};
    vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:2000,height:4000,close})));
    vi.stubGlobal('document',{createElement:()=>canvas});
    const image=await compressImage(new File(['fixture'],'photo.png',{type:'image/png'}));
    expect(image).toMatchObject({width:480,height:960,mime:'image/webp'}); expect(close).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalled();
  });
  it('releases resources even when decoded dimensions are excessive',async()=>{
    const close=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:10000,height:10000,close})));
    await expect(compressImage(new File(['fixture'],'photo.jpg',{type:'image/jpeg'}))).rejects.toThrow('25 megapixels');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
