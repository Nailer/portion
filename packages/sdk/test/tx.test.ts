import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { KeyringPair } from '@polkadot/keyring/types';
import { submit, type WalletSigner } from '../src/tx';

function fixture() {
  const api = { events: { system: { ExtrinsicFailed: { is: () => false } } }, rpc: { chain: { getHeader: async () => ({ number: { toNumber: () => 123 } }) } } } as unknown as ApiPromise;
  const unsubscribe = vi.fn();
  const signAndSend = vi.fn((_account: unknown, _options: unknown, callback: (result: unknown) => void) => {
    callback({ status: { isFinalized: true, asFinalized: { toHex: () => '0xblock' } }, txHash: { toHex: () => '0xtx' }, events: [] });
    return Promise.resolve(unsubscribe);
  });
  return { api, unsubscribe, signAndSend, tx: { signAndSend } as unknown as SubmittableExtrinsic<'promise'> };
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

function controlled() {
  const { api } = fixture();
  let callback: (result: any) => void = () => {};
  const unsubscribe = vi.fn();
  const tx = { signAndSend: vi.fn((_a, _o, cb) => { callback = cb; return Promise.resolve(unsubscribe); }) } as unknown as SubmittableExtrinsic<'promise'>;
  const emit = (status: Record<string, unknown>, extra = {}) => callback({ status, txHash: { toHex: () => '0xtx' }, events: [], ...extra });
  return { api, tx, emit, unsubscribe };
}
afterEach(() => vi.useRealTimers());
describe('finalized transaction receipts', () => {
  const signer = { address: 'external', signer: {} } as WalletSigner;
  it('keeps tracking provisional and retracted blocks until finalization', async () => {
    const f = controlled(); const stage = vi.fn();
    let resolved = false;
    const pending = submit(f.api, f.tx, signer, stage).then(r => { resolved = true; return r; });
    f.emit({ isInBlock: true }); await Promise.resolve();
    expect(resolved).toBe(false); expect(f.unsubscribe).not.toHaveBeenCalled();
    f.emit({ isRetracted: true });
    f.emit({ isFinalized: true, asFinalized: { toHex: () => '0xfinal' } });
    expect(await pending).toMatchObject({ ok: true, blockHash: '0xfinal', blockNumber: 123 });
    expect(stage).toHaveBeenLastCalledWith('finalized', undefined);
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('releases a subscription even when the finalized callback precedes subscription setup', async () => {
    const f = fixture(); await submit(f.api, f.tx, signer);
    await Promise.resolve(); expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('uses a dispatch error even when the failure event is missing', async () => {
    const f = controlled(); const pending = submit(f.api, f.tx, signer);
    f.emit({ isFinalized: true, asFinalized: { toHex: () => '0xfinal' } }, { dispatchError: { toString: () => 'BadOrigin' } });
    expect(await pending).toMatchObject({ ok: false, error: 'BadOrigin' });
  });
  it.each(['isInvalid', 'isDropped', 'isUsurped', 'isFinalityTimeout'])('settles %s without claiming success', async flag => {
    const f = controlled(); const pending = submit(f.api, f.tx, signer);
    const assertion = expect(pending).rejects.toThrow('outcome is unconfirmed');
    f.emit({ [flag]: true, type: flag }); await assertion;
    expect(f.tx.signAndSend).toHaveBeenCalledTimes(1);
  });
  it('times out with an unknown outcome rather than silently retrying', async () => {
    vi.useFakeTimers(); const f = controlled();
    const pending = submit(f.api, f.tx, signer);
    const assertion = expect(pending).rejects.toThrow('Check the account history before retrying');
    await vi.advanceTimersByTimeAsync(180_000); await assertion;
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
    expect(f.tx.signAndSend).toHaveBeenCalledTimes(1);
  });
});

describe('failed batch receipts', () => {
  it.each(['BatchInterrupted', 'ItemFailed'])('does not treat %s as a successful payment', async method => {
    const f = controlled();
    (f.api.events as any).utility = {
      BatchInterrupted: { is: (e: any) => e.method === 'BatchInterrupted' },
      ItemFailed: { is: (e: any) => e.method === 'ItemFailed' },
    };
    const pending = submit(f.api, f.tx, { address: 'external', signer: {} });
    f.emit({ isFinalized: true, asFinalized: { toHex: () => '0xfinal' } }, {
      events: [{ event: { method, data: method === 'BatchInterrupted' ? [2, 'BadOrigin'] : ['BadOrigin'] } }],
    });
    expect(await pending).toMatchObject({ ok: false });
  });
});
