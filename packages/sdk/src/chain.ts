import { ApiPromise, WsProvider } from '@polkadot/api';
import { TESTNET } from './constants';

export async function connect(ws: string = TESTNET.ws, timeoutMs = 12_000): Promise<ApiPromise> {
  const provider = new WsProvider(ws, 2_500);
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = ApiPromise.create({ provider, noInitWarn: true });
    void ready.then(api=>{if(expired) void api.disconnect().catch(()=>{});},()=>{});
    return await Promise.race([ready,new Promise<never>((_,reject)=>{
      timer=setTimeout(()=>{expired=true;reject(new Error('Portaldot RPC initialization timed out. No transaction was submitted.'));},timeoutMs);
    })]);
  } catch(error) {
    expired=true;
    void provider.disconnect().catch(()=>{});
    throw error;
  } finally {if(timer) clearTimeout(timer);}
}

export async function assetBalance(api: ApiPromise, assetId: number, account: string): Promise<bigint> {
  const r: any = (await api.query.assets.account(assetId, account)).toJSON();
  return r ? BigInt(r.balance) : 0n;
}

export async function nativeFree(api: ApiPromise, account: string): Promise<bigint> {
  const r: any = await api.query.system.account(account);
  return BigInt(r.data.free.toString());
}

export async function assetExists(api: ApiPromise, assetId: number): Promise<boolean> {
  return ((await api.query.assets.asset(assetId)) as any).isSome;
}
