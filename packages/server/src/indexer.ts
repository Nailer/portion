import type { ApiPromise } from '@polkadot/api';
import type { DatabaseSync } from 'node:sqlite';
import { Interface } from 'ethers';
import { PortionArtifact, storedInBlock, type Deployment } from '@portion/sdk';
import { getKv, setKv } from './db.js';

const iface = new Interface(PortionArtifact.abi);
const jsonSafe = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => typeof x === 'bigint' ? x.toString() : x));
export interface IndexerStatus {
  lastIndexed: number;
  finalized: number;
  fromBlock?: number;
  historyComplete: boolean;
  ready: boolean;
  error?: string;
}

/** Finalized-only indexing. A missing block stops progress; it never becomes an empty financial record. */
export class Indexer {
  private busy = false;
  lastIndexed = 0;
  private finalized = 0;
  private error?: string;
  private fromBlock?: number;
  private observedAt = 0;

  constructor(private api: ApiPromise, private db: DatabaseSync, private deployment: Deployment | undefined) {
    this.lastIndexed = Number(getKv(db, 'indexed_to') ?? 0);
    const block = (deployment as Deployment & { deployedBlock?: number } | undefined)?.deployedBlock;
    this.fromBlock = Number.isSafeInteger(block) && block! > 0 ? block : undefined;
  }

  status(): IndexerStatus {
    const historyComplete = !!this.fromBlock && getKv(this.db, 'history_from') === String(this.fromBlock);
    return { lastIndexed: this.lastIndexed, finalized: this.finalized, fromBlock: this.fromBlock, historyComplete,
      ready: !this.error && this.lastIndexed >= this.finalized && this.finalized > 0 && Date.now() - this.observedAt < 60_000, error: this.error };
  }

  async start() {
    // Earlier versions indexed provisional blocks and could skip gaps. Do not silently certify that cursor.
    if (this.lastIndexed > 0 && getKv(this.db, 'indexer_version') !== 'finalized-v2') {
      this.error = 'Legacy index cannot establish complete finalized history. Rebuild using an archive RPC.';
      throw new Error(this.error);
    }
    const identity = `${this.api.genesisHash.toHex()}:${this.deployment?.portion.toLowerCase() ?? 'no-contract'}`;
    const recordedIdentity = getKv(this.db, 'indexer_identity');
    if (recordedIdentity && recordedIdentity !== identity) {
      this.error = 'Index database belongs to a different chain or contract.'; throw new Error(this.error);
    }
    setKv(this.db, 'indexer_identity', identity);
    const finalized = await this.api.rpc.chain.getFinalizedHead();
    this.finalized = (await this.api.rpc.chain.getHeader(finalized)).number.toNumber();
    if (this.lastIndexed === 0) {
      this.lastIndexed = this.fromBlock ? this.fromBlock - 1 : Math.max(0, this.finalized - 60);
      setKv(this.db, 'history_from', String(this.fromBlock ?? this.lastIndexed + 1));
      setKv(this.db, 'indexer_version', 'finalized-v2');
    }
    await this.catchUp();
    return this.api.rpc.chain.subscribeFinalizedHeads(() => void this.catchUp());
  }

  private async catchUp() {
    if (this.busy) return;
    this.busy = true;
    try {
      const finalized = await this.api.rpc.chain.getFinalizedHead();
      this.finalized = (await this.api.rpc.chain.getHeader(finalized)).number.toNumber();
      this.observedAt = Date.now();
      if (this.lastIndexed > this.finalized) throw new Error('Index cursor is ahead of finalized history. Check the network and database.');
      while (this.lastIndexed < this.finalized) {
        const next = this.lastIndexed + 1;
        await this.indexBlock(next);
        this.lastIndexed = next;
      }
      this.error = undefined;
    } catch (e) {
      this.error = (e as Error).message;
      console.error('[indexer]', this.error);
    } finally { this.busy = false; }
  }

  private async indexBlock(number: number) {
    const hash = await this.api.rpc.chain.getBlockHash(number);
    const stored = await storedInBlock(this.api, hash.toHex());
    const logs: { kind: string; listingId: number | null; actor: string | null; data: string; ts: number }[] = [];
    if (this.deployment) {
      const at = await this.api.at(hash);
      // Failed historical state reads propagate. Never skip events and advance the cursor.
      const [events, timestamp] = await Promise.all([at.query.system.events(), at.query.timestamp.now()]);
      const ts = Math.floor(Number(timestamp.toString()) / 1000);
      for (const rec of events as any) {
        const ev = rec.event;
        if (!(this.api.events as any).revive.ContractEmitted.is(ev)) continue;
        const [contract, data, topics] = ev.data as any;
        if (contract.toHex().toLowerCase() !== this.deployment.portion.toLowerCase()) continue;
        const log = iface.parseLog({ topics: topics.map((t: any) => t.toHex()), data: data.toHex() });
        if (!log) throw new Error(`Unknown Portion event in block ${number}; ABI compatibility must be checked.`);
        const args = jsonSafe(Object.fromEntries(log.fragment.inputs.map((input, i) => [input.name, log.args[i]]))) as Record<string, unknown>;
        const actor = args.operator ?? args.buyer ?? args.who ?? args.from ?? args.caller;
        logs.push({ kind: log.name, listingId: args.id !== undefined ? Number(args.id) : null,
          actor: actor ? String(actor).toLowerCase() : null, data: JSON.stringify(args), ts });
      }
    }
    // Events and checkpoint commit together. Replaying a block replaces its derived rows rather than duplicating money.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const s of stored) this.db.prepare('INSERT OR IGNORE INTO docs(hash, block, idx, size, data) VALUES (?,?,?,?,?)')
        .run(s.hash, s.block, s.index, s.size, Buffer.from(s.data));
      this.db.prepare('DELETE FROM events WHERE block = ?').run(number);
      for (const log of logs) this.db.prepare('INSERT INTO events(block, ts, kind, listing_id, actor, data) VALUES (?,?,?,?,?,?)')
        .run(number, log.ts, log.kind, log.listingId, log.actor, log.data);
      setKv(this.db, 'indexed_to', String(number));
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}
