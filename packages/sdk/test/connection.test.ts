import { afterEach, describe, expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({create:vi.fn(),disconnect:vi.fn(async()=>{})}));
vi.mock('@polkadot/api',()=>({ApiPromise:{create:fixture.create},WsProvider:class{disconnect=fixture.disconnect;}}));
import { connect } from '../src/chain';
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
describe('bounded RPC initialization',()=>{
  it('closes a failed provider instead of leaving an automatic retry loop alive',async()=>{
    fixture.create.mockRejectedValueOnce(new Error('Metadata unavailable'));
    await expect(connect('ws://fixture',100)).rejects.toThrow('Metadata unavailable');
    expect(fixture.disconnect).toHaveBeenCalledTimes(1);
  });
  it('times out promptly and closes any API that becomes ready after cancellation',async()=>{
    vi.useFakeTimers();let resolve!:(api:any)=>void;
    fixture.create.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
    const pending=connect('ws://fixture',100);const rejected=expect(pending).rejects.toThrow('No transaction was submitted');
    await vi.advanceTimersByTimeAsync(101);await rejected;
    expect(fixture.disconnect).toHaveBeenCalledTimes(1);
    const late={disconnect:vi.fn(async()=>{})};resolve(late);await Promise.resolve();await Promise.resolve();
    expect(late.disconnect).toHaveBeenCalledTimes(1);
  });
});
