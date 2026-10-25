import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import type { Passport } from '@portion/sdk';
import { ss58ToH160 } from '@portion/sdk/addresses';
import type { Signer } from '@polkadot/api/types';

export interface WalletAccount { address: string; name?: string; type?: string }
export interface InjectedWallet {
  accounts: { get(): Promise<WalletAccount[]>; subscribe?: (callback: (accounts: WalletAccount[]) => void) => (() => void) | Promise<() => void> };
  signer: Signer;
}
export interface WalletProvider { enable(origin: string): Promise<InjectedWallet>; version?: string }
export type WalletProviders = Record<string, WalletProvider>;

export function walletAddress(address: string) {
  const bytes = decodeAddress(address);
  if (bytes.length !== 32) throw new Error('This account cannot sign Portaldot native transactions. Choose a Substrate account in your wallet.');
  return encodeAddress(bytes, 42);
}

export async function requestWallet(provider: WalletProvider | undefined) {
  if (!provider) throw new Error('Wallet not detected. Open Portion in the browser where your wallet is installed.');
  const wallet = await provider.enable('Portion');
  if (!wallet?.signer?.signPayload) throw new Error('This wallet does not provide native transaction signing.');
  const accounts = (await wallet.accounts.get()).filter(account => {
    try { walletAddress(account.address); return true; } catch { return false; }
  });
  if (!accounts.length) throw new Error('No compatible accounts were shared. Allow an account in your wallet and try again.');
  return { wallet, accounts };
}

export function walletPassport(account: WalletAccount, wallet: InjectedWallet, assertActive: () => void = () => {}): Passport {
  const address = walletAddress(account.address);
  // Check every request, including later signatures in a multi-transaction upload.
  // A signature already approved by the extension cannot be revoked here.
  const signer: Signer = { signPayload: async payload => {
    assertActive();
    if (walletAddress(payload.address) !== address) throw new Error('The signing request belongs to a different account. Start a new review.');
    if (payload.genesisHash.toLowerCase() !== '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd') throw new Error('The signing request is for a different network.');
    if (!wallet.signer.signPayload) throw new Error('Native signing is unavailable.');
    const signature = await wallet.signer.signPayload(payload);
    assertActive();
    return signature;
  } };
  return { address, h160: ss58ToH160(address), kind: 'extension', pair: { address: account.address, signer } };
}

export function installedWallets(): WalletProviders {
  return (window as Window & { injectedWeb3?: WalletProviders }).injectedWeb3 ?? {};
}

export function walletLabel(id: string) {
  if (isPortaldotWallet(id)) return 'Portaldot Wallet';
  return ({ talisman: 'Talisman', 'subwallet-js': 'SubWallet', 'polkadot-js': 'Polkadot.js' } as Record<string,string>)[id] ?? id;
}

/** Keep the network's wallet first without inventing an installed provider. */
export function isPortaldotWallet(id: string) {
  return ['portaldot', 'portaldotjs', 'portaldotwallet', 'portaldotextension'].includes(id.toLowerCase().replace(/[^a-z0-9]/g, ''));
}
export function orderedWallets(providers: WalletProviders) {
  return Object.keys(providers).sort((a, b) => Number(isPortaldotWallet(b)) - Number(isPortaldotWallet(a)));
}
export const PORTALDOT_WALLET_URL = 'https://chromewebstore.google.com/detail/portaldot-extension/cpdecangbhmfijmlmjglfcocfpaojceo';
