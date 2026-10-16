import { ApiPromise, WsProvider } from '@polkadot/api';
import { TESTNET } from './constants';

export async function connect(ws: string = TESTNET.ws): Promise<ApiPromise> {
  const provider = new WsProvider(ws, 2_500);
  return ApiPromise.create({ provider, noInitWarn: true });
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
