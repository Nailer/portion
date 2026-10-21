import { describe, expect, it, vi } from 'vitest';
import type { ApiPromise } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { resolveTarget } from '../src/faucet';
const native='5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4';
const h160='0xdd62efd46da4acc4b8b2c7e3bf1685b2c9cee167';
describe('faucet recipient resolution',()=>{
  it('uses the registered account rather than an assumed fallback',async()=>{
    const accountId=vi.fn().mockResolvedValue({toString:()=>native});
    const api={call:{reviveApi:{accountId}}} as unknown as ApiPromise;
    expect(await resolveTarget(h160,api)).toEqual({ss58:native,h160,viaEvm:true});
    expect(accountId).toHaveBeenCalledWith(h160);
  });
  it('fails closed if runtime resolution is unavailable',async()=>{
    const api={call:{reviveApi:{accountId:vi.fn().mockRejectedValue(new Error('offline'))}}} as unknown as ApiPromise;
    await expect(resolveTarget(h160,api)).rejects.toThrow('offline');
  });
  it('canonicalizes native prefixes so one account cannot bypass cooldowns',async()=>{
    const alternate=encodeAddress(decodeAddress(native),0);
    expect((await resolveTarget(alternate,{} as ApiPromise)).ss58).toBe(native);
  });
  it('rejects malformed recipients',async()=>{
    await expect(resolveTarget('invalid',{} as ApiPromise)).rejects.toThrow('does not look');
  });
});
