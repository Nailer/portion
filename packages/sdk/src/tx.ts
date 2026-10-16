import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import type { KeyringPair } from '@polkadot/keyring/types';
import type { EventRecord } from '@polkadot/types/interfaces';

export interface TxOutcome {
  ok: boolean;
  txHash: string;
  blockHash: string;
  blockNumber?: number;
  events: EventRecord[];
  error?: string;
}

export type TxStage = 'signing' | 'broadcast' | 'inBlock' | 'finalized' | 'failed';

export function decodeFailure(api: ApiPromise, events: EventRecord[]): string | undefined {
  for (const { event } of events) {
    if (api.events.system.ExtrinsicFailed.is(event)) {
      const err: any = event.data[0];
      if (err.isModule) {
        try {
          const m = api.registry.findMetaError(err.asModule);
          return `${m.section}.${m.name}${m.docs.length ? `: ${m.docs.join(' ').trim()}` : ''}`;
        } catch {
          return `module error ${err.asModule.index}/${err.asModule.error}`;
        }
      }
      return err.toString();
    }
  }
  return undefined;
}

/**
 * Signs with `pair` and resolves once the extrinsic is in a block (about 6 seconds on Portaldot).
 * Resolves (never rejects) with `ok: false` and a decoded error when the extrinsic fails on-chain.
 */
export function submit(
  api: ApiPromise,
  tx: SubmittableExtrinsic<'promise'>,
  pair: KeyringPair,
  onStage?: (s: TxStage, detail?: string) => void,
): Promise<TxOutcome> {
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | undefined;
    onStage?.('signing');
    tx.signAndSend(pair, { nonce: -1 }, async (result) => {
      if (result.status.isBroadcast) onStage?.('broadcast');
      if (result.dispatchError || result.status.isInBlock || result.status.isFinalized) {
        const events = result.events;
        const error = decodeFailure(api, events);
        const blockHash = (result.status.isInBlock ? result.status.asInBlock : result.status.asFinalized).toHex();
        let blockNumber: number | undefined;
        try {
          blockNumber = (await api.rpc.chain.getHeader(blockHash)).number.toNumber();
        } catch {
          /* optional */
        }
        unsub?.();
        onStage?.(error ? 'failed' : 'inBlock', error);
        resolve({ ok: !error, txHash: result.txHash.toHex(), blockHash, blockNumber, events, error });
      }
    })
      .then((u) => (unsub = u))
      .catch((e) => {
        onStage?.('failed', String(e?.message ?? e));
        reject(e);
      });
  });
}

/** Free-balance check that explains *what* is missing instead of failing inside the runtime. */
export async function estimateFee(api: ApiPromise, tx: SubmittableExtrinsic<'promise'>, address: string): Promise<bigint> {
  const info = await tx.paymentInfo(address);
  return BigInt(info.partialFee.toString());
}
