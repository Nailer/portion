import { Keyring } from '@polkadot/keyring';
import type { KeyringPair } from '@polkadot/keyring/types';
import { cryptoWaitReady, keccakAsU8a, mnemonicGenerate } from '@polkadot/util-crypto';
import { stringToU8a, u8aConcat, hexToU8a } from '@polkadot/util';
import { ss58ToH160 } from './addresses';
import type { TransactionSigner } from './tx';

/**
 * Transaction identity for native Portaldot modules and their contract address mapping.
 * The web app uses injected extension signers for live accounts and memory-only demo identities.
 * Mnemonic helpers below serve local development scripts; they must not be exposed as web sign-in.
 * Legacy signature derivation is retained only for compatibility/recovery by existing SDK consumers.
 */
export interface Passport {
  pair: TransactionSigner;
  address: string; // SS58 (prefix 42)
  h160: string; // what Solidity sees
  kind: 'guest' | 'metamask' | 'import' | 'extension';
  mnemonic?: string;
}

let ready: Promise<boolean> | undefined;
export const ensureCrypto = () => (ready ??= cryptoWaitReady());

const keyring = () => new Keyring({ type: 'sr25519', ss58Format: 42 });

function wrap(pair: KeyringPair, kind: Passport['kind'], mnemonic?: string): Passport {
  return { pair, address: pair.address, h160: ss58ToH160(pair.address), kind, mnemonic };
}

export async function guestPassport(): Promise<Passport> {
  await ensureCrypto();
  const mnemonic = mnemonicGenerate(12);
  return wrap(keyring().addFromUri(mnemonic), 'guest', mnemonic);
}

export async function passportFromMnemonic(mnemonic: string, kind: Passport['kind'] = 'import'): Promise<Passport> {
  await ensureCrypto();
  return wrap(keyring().addFromUri(mnemonic.trim()), kind, mnemonic.trim());
}

/** @deprecated Legacy SDK recovery only. Never use this message for new web sign-in. */
export const PASSPORT_MESSAGE =
  'Unlock your Portion Passport\n\n' +
  'This signature creates a spending key for Portion in this browser. ' +
  'It does not cost gas and does not authorise any transfer by itself.\n\n' +
  'Version: 1';

/** @deprecated Derives a spending key. The web app instead delegates signing to an extension. */
export async function passportFromSignature(signatureHex: string): Promise<Passport> {
  await ensureCrypto();
  const seed = keccakAsU8a(u8aConcat(stringToU8a('portion-passport-v1'), hexToU8a(signatureHex)));
  const pair = keyring().addFromSeed(seed);
  return wrap(pair, 'metamask');
}
