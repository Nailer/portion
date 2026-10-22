import { describe, expect, it, vi } from 'vitest';
import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { KeyringPair } from '@polkadot/keyring/types';
import { submit, type WalletSigner } from '../src/tx';

function fixture() {
  const api = { events: { system: { ExtrinsicFailed: { is: () => false } } }, rpc: { chain: { getHeader: async () => ({ number: { toNumber: () => 123 } }) } } } as unknown as ApiPromise;
  const unsubscribe = vi.fn();
  const signAndSend = vi.fn((_account: unknown, _options: unknown, callback: (result: unknown) => void) => {
    callback({ status: { isInBlock: true, asInBlock: { toHex: () => '0xblock' } }, txHash: { toHex: () => '0xtx' }, events: [] });
    return Promise.resolve(unsubscribe);
  });
  return { api, signAndSend, tx: { signAndSend } as unknown as SubmittableExtrinsic<'promise'> };
}

describe('transaction signer routing', () => {
  it('passes the public account and wallet signer to Polkadot API', async () => {
    const { api, tx, signAndSend } = fixture();
    const signer = { signPayload: vi.fn() };
    const wallet = { address: 'external-account', signer } as unknown as WalletSigner;
    const result = await submit(api, tx, wallet);
    expect(signAndSend.mock.calls[0][0]).toBe('external-account');
    expect(signAndSend.mock.calls[0][1]).toEqual({ nonce: -1, signer });
    expect(result.ok).toBe(true);
    expect(signer.signPayload).not.toHaveBeenCalled(); // API/extension controls the signing ceremony.
  });
  it('preserves locally signed development scripts', async () => {
    const { api, tx, signAndSend } = fixture();
    const pair = { address: 'development-account', sign: vi.fn() } as unknown as KeyringPair;
    await submit(api, tx, pair);
    expect(signAndSend.mock.calls[0][0]).toBe(pair);
    expect(signAndSend.mock.calls[0][1]).toEqual({ nonce: -1 });
  });
  it('surfaces a wallet rejection without retrying or broadcasting through another signer', async () => {
    const { api } = fixture();
    const signAndSend = vi.fn().mockRejectedValue(new Error('User rejected signing'));
    const tx = { signAndSend } as unknown as SubmittableExtrinsic<'promise'>;
    await expect(submit(api, tx, { address: 'external', signer: {} })).rejects.toThrow('User rejected signing');
    expect(signAndSend).toHaveBeenCalledTimes(1);
  });
});
