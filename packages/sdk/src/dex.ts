import type { ApiPromise } from '@polkadot/api';

export type AssetKind = { Native: null } | { WithId: number };
export const native = (): AssetKind => ({ Native: null });
export const withId = (id: number): AssetKind => ({ WithId: id });

export async function reserves(api: ApiPromise, a: AssetKind, b: AssetKind): Promise<[bigint, bigint] | null> {
  const r: any = (await (api.call as any).assetConversionApi.getReserves(a, b)).toJSON();
  if (!r) return null;
  return [BigInt(r[0]), BigInt(r[1])];
}

/** Output you would receive for `amountIn` of `a` into the pool `a`/`b` (includes the 0.3% LP fee). */
export async function quoteExactIn(api: ApiPromise, a: AssetKind, b: AssetKind, amountIn: bigint): Promise<bigint | null> {
  const r: any = (await (api.call as any).assetConversionApi.quotePriceExactTokensForTokens(a, b, amountIn, true)).toJSON();
  return r === null || r === undefined ? null : BigInt(r);
}

export function createPoolAndSeed(
  api: ApiPromise,
  a: AssetKind,
  b: AssetKind,
  amountA: bigint,
  amountB: bigint,
  mintTo: string,
) {
  return api.tx.utility.batchAll([
    api.tx.assetConversion.createPool(a, b),
    api.tx.assetConversion.addLiquidity(a, b, amountA, amountB, 0, 0, mintTo),
  ]);
}

export function swapExactIn(api: ApiPromise, path: AssetKind[], amountIn: bigint, minOut: bigint, to: string) {
  return api.tx.assetConversion.swapExactTokensForTokens(path, amountIn, minOut, to, true);
}
