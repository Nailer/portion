import type { ApiPromise } from '@polkadot/api';
import type { DatabaseSync } from 'node:sqlite';
import { Interface } from 'ethers';
import { PortionArtifact, storedInBlock, type Deployment } from '@portion/sdk';
import { getKv, setKv } from './db.js';

const iface = new Interface(PortionArtifact.abi);
const jsonSafe = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x)));

/**
 * Follows the chain head and keeps two things in SQLite:
 *  - every document stored with TransactionStorage (so the gateway can serve and verify it),
 *  - every event emitted by the Portion contract (activity feed, revenue charts, portfolio history).
 * It can be deleted at any time: everything is re-derivable from the chain.
 */
export class Indexer {
  private busy = false;
  lastIndexed = 0;

  constructor(
    private api: ApiPromise,
    private db: DatabaseSync,
    private deployment: Deployment | undefined,
  ) {
    this.lastIndexed = Number(getKv(db, 'indexed_to') ?? 0);
  }

  async start() {
    const head = (await this.api.rpc.chain.getHeader()).number.toNumber();
    // a stale cursor (older than the node's pruning window) would stall forever, so never start further back than that
    if (this.lastIndexed < head - 200) this.lastIndexed = 0;
    if (this.lastIndexed === 0) {
      // First run: start close to the head, or at the deployment block if we know it.
      const from = this.deployment && (this.deployment as any).deployedBlock ? Number((this.deployment as any).deployedBlock) - 1 : Math.max(0, head - 60);
      this.lastIndexed = from;
    }
    await this.catchUp();
    await this.api.rpc.chain.subscribeNewHeads(() => void this.catchUp());
  }

  private async catchUp() {
    if (this.busy) return;
    this.busy = true;
    try {
      const head = (await this.api.rpc.chain.getHeader()).number.toNumber();
      while (this.lastIndexed < head) {
        const next = this.lastIndexed + 1;
        try {
          await this.indexBlock(next);
        } catch (e) {
          // the public RPC node prunes old blocks; skip what it no longer has instead of stalling
          if (!/4003|discarded|unknown block/i.test((e as Error).message)) throw e;
        }
        this.lastIndexed = next;
        if (next % 20 === 0 || next === head) setKv(this.db, 'indexed_to', String(next));
      }
    } catch (e) {
      console.error('[indexer]', (e as Error).message);
    } finally {
      this.busy = false;
    }
  }

  private async indexBlock(number: number) {
    const hash = await this.api.rpc.chain.getBlockHash(number);

    // documents
    const stored = await storedInBlock(this.api, hash.toHex());
    for (const s of stored) {
      this.db
        .prepare('INSERT OR IGNORE INTO docs(hash, block, idx, size, data) VALUES (?,?,?,?,?)')
        .run(s.hash, s.block, s.index, s.size, Buffer.from(s.data));
    }

    // contract events (needs state, which a pruned node may have discarded: skip rather than stall)
    if (!this.deployment) return;
    const portion = this.deployment.portion.toLowerCase();
    let events: any[];
    let ts: number;
    try {
      const at = await this.api.at(hash);
      events = (await at.query.system.events()) as any;
      ts = Number((await at.query.timestamp.now()).toString()) / 1000;
    } catch (e) {
      console.warn(`[indexer] block ${number}: state unavailable, events skipped`);
      return;
    }
    for (const rec of events) {
      const ev = rec.event;
      if (!(this.api.events as any).revive.ContractEmitted.is(ev)) continue;
      const [contract, data, topics] = ev.data as any;
      if (String(contract.toHex()).toLowerCase() !== portion) continue;
      try {
        const log = iface.parseLog({ topics: topics.map((t: any) => t.toHex()), data: data.toHex() });
        if (!log) continue;
        const args = jsonSafe(Object.fromEntries(log.fragment.inputs.map((inp, i) => [inp.name, log.args[i]]))) as Record<string, unknown>;
        const listingId = args.id !== undefined ? Number(args.id) : null;
        const actor = (args.operator ?? args.buyer ?? args.who ?? args.from ?? args.caller ?? null) as string | null;
        this.db
          .prepare('INSERT INTO events(block, ts, kind, listing_id, actor, data) VALUES (?,?,?,?,?,?)')
          .run(number, Math.floor(ts), log.name, listingId, actor ? String(actor).toLowerCase() : null, JSON.stringify(args));
      } catch (e) {
        console.warn('[indexer] could not decode a Portion log:', (e as Error).message);
      }
    }
  }
}
