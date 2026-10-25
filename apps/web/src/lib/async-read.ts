export interface ReadState<T> { data?: T; error?: Error; loading: boolean }
/** A late or cancelled source never replaces the current account/page reading. */
export function startRead<T>(read: () => Promise<T>, publish: (state: ReadState<T>) => void, timeoutMs = 30000) {
  let settled = false;
  publish({loading:true});
  const timer = setTimeout(()=>{
    if(settled) return; settled=true;
    publish({loading:false,error:new Error('Verified data did not arrive in time. Retry the reading; no substitute balance or record was generated.')});
  },timeoutMs);
  Promise.resolve().then(read).then(data=>{
    if(settled) return; settled=true; clearTimeout(timer); publish({loading:false,data});
  },error=>{
    if(settled) return; settled=true; clearTimeout(timer); publish({loading:false,error:error instanceof Error?error:new Error(String(error))});
  });
  return ()=>{settled=true;clearTimeout(timer);};
}
