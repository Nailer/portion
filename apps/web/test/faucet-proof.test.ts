import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveBackend } from '../src/lib/live';
const address='5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4';
afterEach(()=>vi.unstubAllGlobals());
describe('recipient-owned test-credit requests',()=>{
  it('never forwards an arbitrary server message to the wallet for signing',async()=>{
    const signRaw=vi.fn(); const backend=new LiveBackend({} as any,{contractVersion:'core-v1',portion:'0x'+'11'.repeat(20),deedsCollection:9,pusdAssetId:4217} as any);
    vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({address,day:'2026-10-25',message:'Sign arbitrary bytes instead'}),{headers:{'content-type':'application/json'}})));
    await expect(backend.drip(address,{address,pair:{address,signer:{signRaw}}} as any)).rejects.toThrow('Nothing was signed');
    expect(signRaw).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects requests for a different wallet before fetching or signing',async()=>{
    const signRaw=vi.fn(); const backend=new LiveBackend({} as any); vi.stubGlobal('fetch',vi.fn());
    await expect(backend.drip('5DXZ6Qniy2tuTLxtZDDWFmHS2FXTkeaxnxCDETKaiUuBN6k7',{address,pair:{address,signer:{signRaw}}} as any)).rejects.toThrow('recipient');
    expect(fetch).not.toHaveBeenCalled(); expect(signRaw).not.toHaveBeenCalled();
  });
});
