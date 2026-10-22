import type { ApiPromise } from '@polkadot/api';
import type { KeyringPair } from '@polkadot/keyring/types';
import type { DatabaseSync } from 'node:sqlite';
import { PortionClient, RETENTION_BLOCKS, renewTx, submit, type Deployment } from '@portion/sdk';

/**
 * Keepers do the chores nobody wants to do by hand. Each one is permissionless on-chain, which is the point:
 * anyone can run this and earn the slash tip; Portion just happens to run one.
 *
 *  1. slasher   — slashes the bond of any operator that is overdue by more than two cadences
 *  2. renewer   — renews on-chain documents of live listings before their retention window closes
 *  3. compounder — compounds nomination-pool rewards for members who opted in (native, permissionless)
 */
export class Keepers {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private api: ApiPromise,
    private db: DatabaseSync,
    private pair: KeyringPair,
    private deployment: Deployment | undefined,
    private intervalMs: number,
  ) {}

  start() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private log(kind: string, ref: string, ok: boolean, tx?: string, detail?: string) {
    this.db.prepare('INSERT INTO keeper_log(ts,kind,ref,ok,tx,detail) VALUES (?,?,?,?,?,?)').run(Math.floor(Date.now() / 1000), kind, ref, ok ? 1 : 0, tx ?? null, detail ?? null);
    console.log(`[keeper:${kind}] ${ref} ${ok ? 'ok' : 'FAILED'} ${tx ?? ''} ${detail ?? ''}`);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      if (this.deployment) {
        await this.slasher().catch((e) => this.log('slasher', 'loop', false, undefined, e.message));
        await this.renewer().catch((e) => this.log('renewer', 'loop', false, undefined, e.message));
      }
      await this.compounder().catch((e) => this.log('compounder', 'loop', false, undefined, e.message));
    } finally {
      this.running = false;
    }
  }

  private async slasher() {
    const client = new PortionClient(this.api, this.deployment!);
    for (const l of await client.listings()) {
      if (l.health !== 'Defaulted' || l.vault.bond === 0n) continue;
      try {
        const { tx } = await client.contract.buildCall('slash', [l.id], { origin: this.pair.address });
        const out = await submit(this.api, tx, this.pair);
        this.log('slasher', `listing #${l.id} ${l.name}`, out.ok, out.txHash, out.ok ? `bond ${l.vault.bond} → holders` : out.error);
      } catch (e) {
        this.log('slasher', `listing #${l.id}`, false, undefined, (e as Error).message);
      }
    }
  }

  private async renewer() {
    const client = new PortionClient(this.api, this.deployment!);
    const head = (await this.api.rpc.chain.getHeader()).number.toNumber();
    const margin = 14_400; // renew when about a day of retention is left
    for (const l of await client.listings()) {
      if (l.health === 'WoundDown') continue;
      for (const hash of [l.docHash, l.coverHash]) {
        const row = this.db.prepare('SELECT block, idx, renewed_block, renewed_idx FROM docs WHERE hash = ?').get(hash) as
          | { block: number; idx: number; renewed_block: number | null; renewed_idx: number | null }
          | undefined;
        if (!row) continue;
        const block = row.renewed_block ?? row.block;
        const idx = row.renewed_idx ?? row.idx;
        if (head < block + RETENTION_BLOCKS - margin) continue;
        const out = await submit(this.api, renewTx(this.api, block, idx), this.pair);
        if (out.ok) {
          const rec: any = out.events.find((e) => (this.api.events as any).transactionStorage.Renewed.is(e.event));
          if (!rec || rec.event.data[1].toHex().toLowerCase() !== hash.toLowerCase()) {
            this.log('renewer', hash.slice(0, 12), false, out.txHash, 'Renewal receipt did not confirm this document. Retention was not updated.');
            continue;
          }
          const newIdx = Number(rec.event.data[0].toString());
          this.db.prepare('UPDATE docs SET renewed_block = ?, renewed_idx = ? WHERE hash = ?').run(out.blockNumber ?? head, newIdx, hash);
        }
        this.log('renewer', `${hash.slice(0, 12)}… (listing #${l.id})`, out.ok, out.txHash, out.ok ? 'retention extended' : out.error);
      }
    }
  }

  private async compounder() {
    const members = await this.api.query.nominationPools.poolMembers.entries();
    for (const [key] of members) {
      const member = key.args[0].toString();
      const perm: any = (await this.api.query.nominationPools.claimPermissions(member)).toJSON();
      const p = typeof perm === 'string' ? perm : Object.keys(perm ?? {})[0] ?? 'Permissioned';
      if (!/PermissionlessCompound|PermissionlessAll/i.test(p)) continue;
      const pending = BigInt(((await (this.api.call as any).nominationPoolsApi.pendingRewards(member)).toString()) || '0');
      if (pending < 10n ** 12n) continue; // below 0.01 tPOT: not worth a transaction
      const tx = this.api.tx.nominationPools.bondExtraOther(member, 'Rewards');
      const out = await submit(this.api, tx, this.pair);
      this.log('compounder', member.slice(0, 10) + '…', out.ok, out.txHash, out.ok ? `compounded ${pending}` : out.error);
    }
  }
}
