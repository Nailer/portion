import { describe, expect, it, vi } from 'vitest';
import type { Signer } from '@polkadot/api/types';
import { requestWallet, walletPassport, walletAddress, type InjectedWallet } from '../src/lib/wallet';
const address = '5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4';
const signer = { signPayload: vi.fn() } as unknown as Signer;
const wallet: InjectedWallet = { signer, accounts: { get: async () => [{ address, name: 'Test account' }] } };

describe('wallet-owned signing', () => {
  it('only asks the selected extension to share public accounts', async () => {
    const enable = vi.fn().mockResolvedValue(wallet);
    const result = await requestWallet({ enable });
    expect(enable).toHaveBeenCalledWith('Portion');
    expect(result.accounts).toEqual([{ address, name: 'Test account' }]);
    expect(signer.signPayload).not.toHaveBeenCalled();
  });
  it('creates an external signer account without a recovery phrase or spending key', () => {
    const account = walletPassport({ address }, wallet);
    expect(account.kind).toBe('extension');
    expect(account.pair).toEqual({ address, signer });
    expect(account).not.toHaveProperty('mnemonic');
    expect(account.pair).not.toHaveProperty('secretKey');
    expect(account.address).toBe(walletAddress(address));
  });
  it('fails clearly when a wallet is missing or access is denied', async () => {
    await expect(requestWallet(undefined)).rejects.toThrow('not detected');
    await expect(requestWallet({ enable: async () => { throw new Error('User rejected connection'); } })).rejects.toThrow('User rejected connection');
  });
  it('does not accept addresses or extensions incapable of native signing', async () => {
    expect(() => walletAddress('0x1111111111111111111111111111111111111111')).toThrow();
    await expect(requestWallet({ enable: async () => ({ ...wallet, signer: {} }) })).rejects.toThrow('native transaction signing');
    await expect(requestWallet({ enable: async () => ({ ...wallet, accounts: { get: async () => [] } }) })).rejects.toThrow('No compatible accounts');
  });
});
