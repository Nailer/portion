import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { ss58ToH160, type Passport } from '@portion/sdk';
import type { Signer } from '@polkadot/api/types';

export interface WalletAccount { address: string; name?: string; type?: string }
export interface InjectedWallet {
  accounts: { get(): Promise<WalletAccount[]>; subscribe?: (callback: (accounts: WalletAccount[]) => void) => (() => void) };
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

export function walletPassport(account: WalletAccount, wallet: InjectedWallet): Passport {
  const address = walletAddress(account.address);
  return { address, h160: ss58ToH160(address), kind: 'extension', pair: { address: account.address, signer: wallet.signer } };
}

export function installedWallets(): WalletProviders {
  return (window as Window & { injectedWeb3?: WalletProviders }).injectedWeb3 ?? {};
}

export function walletLabel(id: string) {
  return ({ talisman: 'Talisman', 'subwallet-js': 'SubWallet', 'polkadot-js': 'Polkadot.js' } as Record<string,string>)[id] ?? id;
}
