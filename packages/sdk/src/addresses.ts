import type { ApiPromise } from '@polkadot/api';
import { decodeAddress, encodeAddress, keccakAsU8a } from '@polkadot/util-crypto';
import { hexToU8a, u8aToHex } from '@polkadot/util';
import { ASSET_PRECOMPILE_PREFIX } from './constants';

const FALLBACK_PAD = new Uint8Array(12).fill(0xee);

export function isH160(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

/**
 * The H160 that Solidity sees as `msg.sender` for a Substrate account.
 * pallet-revive rule (verified against `reviveApi.address` on the live testnet):
 *  - an "Ethereum-shaped" account (last 12 bytes == 0xEE) is just its first 20 bytes;
 *  - every other account maps to the last 20 bytes of keccak256(accountId).
 */
export function ss58ToH160(ss58: string): string {
  const raw = decodeAddress(ss58);
  if (raw.subarray(20).every((b) => b === 0xee)) return u8aToHex(raw.subarray(0, 20));
  return u8aToHex(keccakAsU8a(raw).subarray(12));
}

/** Substrate account a contract/EOA H160 resolves to when it has never been mapped: H160 ++ 0xEE×12. */
export function h160ToFallbackSs58(h160: string, ss58Format = 42): string {
  if (!isH160(h160)) throw new Error(`not an H160: ${h160}`);
  const raw = new Uint8Array(32);
  raw.set(hexToU8a(h160), 0);
  raw.set(FALLBACK_PAD, 20);
  return encodeAddress(raw, ss58Format);
}

/**
 * ERC-20 address of a native `pallet-assets` asset, as exposed by AssetsPrecompiles:
 * `[assetId: 4 bytes][12 zero bytes][prefix: 2 bytes][2 zero bytes]`.
 */
export function assetErc20Address(assetId: number, prefix = ASSET_PRECOMPILE_PREFIX): string {
  const b = new Uint8Array(20);
  new DataView(b.buffer).setUint32(0, assetId, false);
  new DataView(b.buffer).setUint16(16, prefix, false);
  return u8aToHex(b);
}

export function shortAddr(a: string, head = 6, tail = 4): string {
  return a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;
}

/** Resolve an H160 using the chain's registered mapping; fallback padding alone is not enough for mapped accounts. */
export async function resolveH160Account(api: ApiPromise, h160: string): Promise<string> {
  if (!isH160(h160)) throw new Error('Invalid H160 address.');
  const account = await (api.call as any).reviveApi.accountId(h160);
  return encodeAddress(decodeAddress(account.toString()),42);
}
