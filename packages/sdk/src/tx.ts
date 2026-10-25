import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { KeyringPair } from '@polkadot/keyring/types';
import type { EventRecord } from '@polkadot/types/interfaces';
import type { Signer } from '@polkadot/api/types';

/** An injected wallet owns the key; the application only holds its public address and signer. */
export interface WalletSigner { address: string; signer: Signer }
export type TransactionSigner = KeyringPair | WalletSigner;

export interface TxOutcome {
  ok: boolean;
  txHash: string;
  blockHash: string;
  blockNumber?: number;
  events: EventRecord[];
  error?: string;
}

export type TxStage = 'signing' | 'broadcast' | 'inBlock' | 'finalized' | 'failed';

export class UnconfirmedTransactionError extends Error {
  constructor(reason: string, readonly txHash?: string) {
    super(`${reason}. The transaction outcome is unconfirmed${txHash ? ` (${txHash})` : ''}. Check the account history before retrying.`);
    this.name = 'UnconfirmedTransactionError';
  }
}

function dispatchMessage(api: ApiPromise, error: any): string {
  if (error?.isModule) {
    try {
      const meta = api.registry.findMetaError(error.asModule);
      return `${meta.section}.${meta.name}${meta.docs.length ? `: ${meta.docs.join(' ').trim()}` : ''}`;
    } catch { return `module error ${error.asModule.index}/${error.asModule.error}`; }
  }
  return String(error);
}

export function decodeFailure(api: ApiPromise, events: EventRecord[]): string | undefined {
  for (const { event } of events) {
    const data = event.data;
    if (api.events.system.ExtrinsicFailed.is(event)) return dispatchMessage(api, data[0]);
    const utility = api.events.utility;
    if (utility?.BatchInterrupted?.is(event)) return `Batch call ${data[0]} failed: ${dispatchMessage(api, data[1])}`;
    if (utility?.ItemFailed?.is(event)) return `Batch item failed: ${dispatchMessage(api, data[0])}`;
  }
  return undefined;
}

/**
 * A successful receipt means finalized inclusion, not just a provisional block.
 * Tracking failures reject with an explicit unknown outcome; callers must not automatically retry.
 */
export function submit(
  api: ApiPromise,
  tx: SubmittableExtrinsic<'promise'>,
  pair: TransactionSigner,
  onStage?: (s: TxStage, detail?: string) => void,
  submission?: { nonce: string },
): Promise<TxOutcome> {
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;
    let settled = false;
    let finalizing = false;
    let txHash: string | undefined;
    const cleanup = () => { clearTimeout(timer); unsub?.(); unsub = undefined; };
    const fail = (error: Error) => {
      if (settled) return;
      const reported = txHash && !(error instanceof UnconfirmedTransactionError) ? new UnconfirmedTransactionError(error.message, txHash) : error;
      settled = true; cleanup(); onStage?.('failed', reported.message); reject(reported);
    };
    const unknown = (reason: string) => new UnconfirmedTransactionError(reason, txHash);
    const timer = setTimeout(() => fail(unknown('Transaction tracking timed out')), 180_000);
    onStage?.('signing');
    const account = 'signer' in pair ? pair.address : pair;
    const nonce = submission?.nonce ?? -1;
    const options = 'signer' in pair ? { nonce, signer: pair.signer } : { nonce };
    try {
      Promise.resolve(tx.signAndSend(account, options, (result) => {
        if (settled || finalizing) return;
        txHash = result.txHash.toHex();
        const status = result.status;
        if (status.isInvalid || status.isDropped || status.isUsurped || status.isFinalityTimeout) {
          fail(unknown(`Network status: ${status.type}`)); return;
        }
        if (status.isRetracted) { onStage?.('broadcast', 'Provisional block was retracted; waiting for finalized inclusion.'); return; }
        if (status.isBroadcast) onStage?.('broadcast');
        if (status.isInBlock) { onStage?.('inBlock', 'Included provisionally; waiting for finalization.'); return; }
        if (!status.isFinalized) return;
        finalizing = true;
        cleanup();
        // Freeze the finalized receipt before the optional block-number lookup.
        const events = result.events;
        const error = decodeFailure(api, events) ?? (result.dispatchError ? dispatchMessage(api, result.dispatchError) : undefined);
        const blockHash = status.asFinalized.toHex();
        const finish = (blockNumber?: number) => {
          if (settled) return;
          settled = true; cleanup();
          onStage?.(error ? 'failed' : 'finalized', error);
          resolve({ ok: !error, txHash: result.txHash.toHex(), blockHash, blockNumber, events, error });
        };
        // The finalized hash remains sufficient evidence if a header read fails.
        const headerTimer = setTimeout(() => finish(), 2000);
        Promise.resolve().then(() => api.rpc.chain.getHeader(blockHash)).then(header => { clearTimeout(headerTimer); finish(header.number.toNumber()); }, () => { clearTimeout(headerTimer); finish(); });
      })).then(unsubscribe => {
        // A callback may finish before signAndSend returns its unsubscribe function.
        if (settled || finalizing) unsubscribe(); else unsub = unsubscribe;
      }, error => fail(error instanceof Error ? error : new Error(String(error))));
    } catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
  });
}

/** Free-balance check that explains *what* is missing instead of failing inside the runtime. */
export async function estimateFee(api: ApiPromise, tx: SubmittableExtrinsic<'promise'>, address: string): Promise<bigint> {
  const info = await tx.paymentInfo(address);
  return BigInt(info.partialFee.toString());
}
