import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRead } from '../src/lib/async-read';
afterEach(()=>vi.useRealTimers());
describe('bounded account and service readings',()=>{
  it('ignores a previous account response after the subscription is cancelled',async()=>{
    let resolve!:(value:string)=>void; const publish=vi.fn();
    const cancel=startRead(()=>new Promise<string>(r=>{resolve=r;}),publish);
    await Promise.resolve(); cancel(); resolve('previous-account-balance'); await Promise.resolve(); await Promise.resolve();
    expect(publish.mock.calls).toEqual([[{loading:true}]]);
  });
  it('times out without inventing zero and never overwrites that state with a late response',async()=>{
    vi.useFakeTimers(); let resolve!:(value:number)=>void; const publish=vi.fn();
    startRead(()=>new Promise<number>(r=>{resolve=r;}),publish);
    await vi.advanceTimersByTimeAsync(30001);
    expect(publish.mock.calls.at(-1)?.[0]).toMatchObject({loading:false,error:expect.any(Error)});
    expect(publish.mock.calls.at(-1)?.[0]).not.toHaveProperty('data');
    const calls=publish.mock.calls.length; resolve(123); await Promise.resolve(); await Promise.resolve();
    expect(publish).toHaveBeenCalledTimes(calls);
  });
});
