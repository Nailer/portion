import type { ApiPromise } from '@polkadot/api';
import { blake2AsHex } from '@polkadot/util-crypto';
import { u8aToHex, hexToU8a } from '@polkadot/util';

/** TransactionStorage limit on this runtime (`MaxTransactionSize`, verified from metadata). */
export const MAX_DOC_BYTES = 32_768;
/** Retention window in blocks (`RetentionPeriod`, ~7 days at 6 s blocks). */
export const RETENTION_BLOCKS = 100_800;

export const contentHash = (data: Uint8Array): string => blake2AsHex(data, 256);

/**
 * `store` must be sent as its own top-level extrinsic, not wrapped in a batch: the pallet indexes the *tail of the
 * extrinsic* as the stored bytes, which a wrapper would break.
 */
export function storeTx(api: ApiPromise, data: Uint8Array) {
  if (data.length > MAX_DOC_BYTES) throw new Error(`document is ${data.length} bytes, limit is ${MAX_DOC_BYTES}`);
  return api.tx.transactionStorage.store(u8aToHex(data));
}

export const renewTx = (api: ApiPromise, block: number, index: number) => api.tx.transactionStorage.renew(block, index);

export interface StoredItem {
  hash: string;
  size: number;
  block: number;
  /** TransactionStorage index emitted by Stored; this is the index required by renew. */
  index: number;
  data: Uint8Array;
}

/** Only return accepted stores, using their pallet index rather than their extrinsic position. */
export async function storedInBlock(api: ApiPromise, blockHash: string): Promise<StoredItem[]> {
  const [signed, at]: any[] = await Promise.all([api.rpc.chain.getBlock(blockHash), api.at(blockHash)]);
  const records: any = await at.query.system.events();
  const number = signed.block.header.number.toNumber();
  const out: StoredItem[] = [];
  signed.block.extrinsics.forEach((ex: any, extrinsicIndex: number) => {
    if (ex.method.section !== 'transactionStorage' || ex.method.method !== 'store') return;
    const own = [...records].filter((r: any) => r.phase.isApplyExtrinsic && r.phase.asApplyExtrinsic.toNumber() === extrinsicIndex);
    if (own.some((r: any) => api.events.system.ExtrinsicFailed.is(r.event))) return;
    const stored = own.find((r: any) => api.events.transactionStorage.Stored.is(r.event));
    if (!stored) return;
    const data = hexToU8a(ex.method.args[0].toHex());
    const hash = contentHash(data);
    if (hash !== stored.event.data[1].toHex().toLowerCase()) throw new Error(`Stored content hash mismatch in block ${number}, extrinsic ${extrinsicIndex}.`);
    out.push({ hash, size: data.length, block: number, index: stored.event.data[0].toNumber(), data });
  });
  return out;
}
