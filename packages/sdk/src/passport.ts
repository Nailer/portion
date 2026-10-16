import { Keyring } from '@polkadot/keyring';
import type { KeyringPair } from '@polkadot/keyring/types';
import { cryptoWaitReady, keccakAsU8a, mnemonicGenerate } from '@polkadot/util-crypto';
import { stringToU8a, u8aConcat, hexToU8a } from '@polkadot/util';
import { ss58ToH160 } from './addresses';

/**
 * A "Passport" is the Substrate account Portion signs with on the user's behalf. It exists because Portaldot V3
 * has two address worlds: MetaMask users only reach Solidity, but the interesting modules (Nfts, fractionalization,
 * the DEX, pools, on-chain storage) are native extrinsics that MetaMask cannot sign.
 *
 * Three ways in, all producing the same kind of account:
 *  - guest:      random mnemonic kept in the browser (zero friction, try it in 5 seconds)
 *  - MetaMask:   key derived from one personal_sign, so the same wallet always unlocks the same Passport
 *  - import:     any mnemonic / raw seed
 */
export interface Passport {
  pair: KeyringPair;
  address: string; // SS58 (prefix 42)
  h160: string; // what Solidity sees
  kind: 'guest' | 'metamask' | 'import';
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

/** The exact text MetaMask is asked to sign. It must never change, or users would lose their Passport. */
export const PASSPORT_MESSAGE =
  'Unlock your Portion Passport\n\n' +
  'This signature creates a spending key for Portion in this browser. ' +
  'It does not cost gas and does not authorise any transfer by itself.\n\n' +
  'Version: 1';

export async function passportFromSignature(signatureHex: string): Promise<Passport> {
  await ensureCrypto();
  const seed = keccakAsU8a(u8aConcat(stringToU8a('portion-passport-v1'), hexToU8a(signatureHex)));
  const pair = keyring().addFromSeed(seed);
  return wrap(pair, 'metamask');
}
