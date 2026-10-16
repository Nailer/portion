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
  /** Index of the *extrinsic* in the block; this is the `index` argument to `renew`. */
  index: number;
  data: Uint8Array;
}

/** Finds every document stored in a block by decoding its extrinsics (the data lives in the block body). */
export async function storedInBlock(api: ApiPromise, blockHash: string): Promise<StoredItem[]> {
  const signed: any = await api.rpc.chain.getBlock(blockHash);
  const number = signed.block.header.number.toNumber();
  const out: StoredItem[] = [];
  signed.block.extrinsics.forEach((ex: any, index: number) => {
    const { section, method } = ex.method;
    if (section === 'transactionStorage' && method === 'store') {
      const data = hexToU8a(ex.method.args[0].toHex());
      out.push({ hash: contentHash(data), size: data.length, block: number, index, data });
    }
  });
  return out;
}
