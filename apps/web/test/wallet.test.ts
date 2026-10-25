import { describe, expect, it, vi } from 'vitest';
import type { Signer } from '@polkadot/api/types';
import { requestWallet, walletPassport, walletAddress, orderedWallets, walletLabel, type InjectedWallet } from '../src/lib/wallet';
const address = '5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4';
const signer = { signPayload: vi.fn() } as unknown as Signer;
const wallet: InjectedWallet = { signer, accounts: { get: async () => [{ address, name: 'Test account' }] } };

describe('wallet-owned signing', () => {
  it('puts detected Portaldot providers first without inventing an installed wallet', () => {
    const provider = { enable: vi.fn() };
    expect(orderedWallets({ talisman: provider, 'portaldot-js': provider, 'polkadot-js': provider })).toEqual(['portaldot-js', 'talisman', 'polkadot-js']);
    expect(walletLabel('portaldot-js')).toBe('Portaldot Wallet');
    expect(orderedWallets({ talisman: provider })).toEqual(['talisman']);
  });
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
    expect(account.pair).toMatchObject({ address, signer: { signPayload: expect.any(Function) } });
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
  it('checks authorization again before each signature and rejects another account or network', async () => {
    const signPayload = vi.fn().mockResolvedValue({ id: 1, signature: '0x00' });
    let active = true;
    const account = walletPassport({ address }, { ...wallet, signer: { signPayload } }, () => {
      if (!active) throw new Error('Account changed');
    });
    const payload: any = { address, genesisHash: '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd' };
    const external = (account.pair as any).signer;
    await external.signPayload(payload);
    active = false;
    await expect(external.signPayload(payload)).rejects.toThrow('Account changed');
    active = true;
    await expect(external.signPayload({ ...payload, address: '5DXZ6Qniy2tuTLxtZDDWFmHS2FXTkeaxnxCDETKaiUuBN6k7' })).rejects.toThrow('different account');
    await expect(external.signPayload({ ...payload, genesisHash: '0x' + '00'.repeat(32) })).rejects.toThrow('different network');
    expect(signPayload).toHaveBeenCalledTimes(1);
  });
});
