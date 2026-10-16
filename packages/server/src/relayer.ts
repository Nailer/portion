import { Contract, Interface, JsonRpcProvider, Wallet, type Provider } from 'ethers';
import type { DatabaseSync } from 'node:sqlite';
import { TeleportArtifact } from '@portion/sdk';
import { getKv, setKv } from './db.js';

const iface = new Interface(TeleportArtifact.abi);
const BRIDGE_OUT = iface.getEvent('BridgeOut')!.topicHash;

const TYPES = {
  Message: [
    { name: 'srcChainId', type: 'uint256' },
    { name: 'dstChainId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
};

export interface Side {
  name: string;
  chainId: number;
  provider: Provider;
  /** pays gas for `bridgeIn` on this chain */
  gas: Wallet;
  teleport: string;
  /** blocks to wait before trusting a BridgeOut log */
  confirmations: number;
  maxLogRange: number;
}

export interface TransferRow {
  id: number;
  src_chain: number;
  nonce: string;
  dst_chain: number;
  sender: string;
  recipient: string;
  amount: string;
  src_tx: string | null;
  status: 'seen' | 'relayed' | 'failed';
  dst_tx: string | null;
  error: string | null;
  ts: number;
}

/**
 * The v0 relay committee. It watches `BridgeOut` on both chains and, once a transfer is final on its source chain, has
 * `threshold` of the relayer keys sign an EIP-712 message bound to the destination chain and contract, then submits
 * `bridgeIn` there. The contract checks everything again, so a buggy or malicious relayer process can delay a transfer
 * but cannot mint or release more than was burned or locked, and cannot replay one.
 *
 * In this repo all keys run in one process for the demo. A real deployment runs one process per independent operator.
 */
export class Relayer {
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    private db: DatabaseSync,
    private sides: [Side, Side],
    private relayerKeys: string[],
    private log: (m: string) => void = (m) => console.log(`[relayer] ${m}`),
  ) {}

  start(intervalMs = 10_000) {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      for (const side of this.sides) await this.scan(side).catch((e) => this.log(`scan ${side.name}: ${(e as Error).message}`));
      await this.relayPending().catch((e) => this.log(`relay: ${(e as Error).message}`));
    } finally {
      this.busy = false;
    }
  }

  private other(side: Side) {
    return this.sides[0].chainId === side.chainId ? this.sides[1] : this.sides[0];
  }

  async scan(side: Side) {
    const key = `teleport_cursor_${side.chainId}`;
    const head = await side.provider.getBlockNumber();
    const safe = head - side.confirmations;
    let from = Number(getKv(this.db, key) ?? Math.max(0, safe - 20)) + 1;
    while (from <= safe) {
      const to = Math.min(safe, from + side.maxLogRange - 1);
      const logs = await side.provider.getLogs({ address: side.teleport, fromBlock: from, toBlock: to, topics: [BRIDGE_OUT] });
      for (const l of logs) {
        const p = iface.parseLog(l)!;
        const row = {
          src: side.chainId, nonce: p.args.nonce.toString(), dst: Number(p.args.dstChainId), sender: String(p.args.sender).toLowerCase(),
          recipient: String(p.args.recipient).toLowerCase(), amount: p.args.amount.toString(), tx: l.transactionHash, block: l.blockNumber,
        };
        this.db
          .prepare('INSERT OR IGNORE INTO transfers(src_chain,nonce,dst_chain,sender,recipient,amount,src_tx,src_block,status,ts) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .run(row.src, row.nonce, row.dst, row.sender, row.recipient, row.amount, row.tx, row.block, 'seen', Math.floor(Date.now() / 1000));
        this.log(`saw transfer ${row.src}#${row.nonce}: ${row.amount} → ${row.recipient} on chain ${row.dst}`);
      }
      setKv(this.db, key, String(to));
      from = to + 1;
    }
  }

  private async relayPending() {
    const rows = this.db.prepare("SELECT * FROM transfers WHERE status IN ('seen') ORDER BY id").all() as unknown as TransferRow[];
    for (const t of rows) {
      const dst = this.sides.find((s) => s.chainId === t.dst_chain);
      const src = this.sides.find((s) => s.chainId === t.src_chain);
      if (!dst || !src) { this.mark(t.id, 'failed', undefined, 'unknown destination chain'); continue; }
      try {
        const c = new Contract(dst.teleport, TeleportArtifact.abi, dst.gas);
        if (await c.processed(t.src_chain, t.nonce)) { this.mark(t.id, 'relayed'); continue; }
        const msg = { srcChainId: t.src_chain, dstChainId: t.dst_chain, nonce: t.nonce, recipient: t.recipient, amount: t.amount };
        const threshold = Number(await c.threshold());
        const sigs = await this.sign(dst, msg, threshold);
        const tx = await c.bridgeIn(msg, sigs);
        this.log(`relaying ${t.src_chain}#${t.nonce} to ${dst.name}: ${tx.hash}`);
        await tx.wait();
        this.mark(t.id, 'relayed', tx.hash);
      } catch (e) {
        const msg = (e as Error).message.slice(0, 300);
        this.log(`transfer ${t.src_chain}#${t.nonce} failed: ${msg}`);
        // transient problems (gas, RPC) are retried on the next tick; contract rejections are final
        const final = /AlreadyProcessed|BadSignatures|OverTxCap|OverDailyCap|UnsupportedChain|Paused|WrongDestination/.test(msg);
        if (final) this.mark(t.id, 'failed', undefined, msg);
      }
    }
  }

  private async sign(dst: Side, msg: Record<string, unknown>, threshold: number): Promise<string[]> {
    const domain = { name: 'PortionTeleport', version: '1', chainId: dst.chainId, verifyingContract: dst.teleport };
    const wallets = this.relayerKeys.map((k) => new Wallet(k));
    // the contract requires signers in ascending address order and distinct
    wallets.sort((a, b) => (BigInt(a.address) < BigInt(b.address) ? -1 : 1));
    const picked = wallets.slice(0, threshold);
    return Promise.all(picked.map((w) => w.signTypedData(domain, TYPES, msg)));
  }

  private mark(id: number, status: TransferRow['status'], dstTx?: string, error?: string) {
    this.db.prepare('UPDATE transfers SET status = ?, dst_tx = COALESCE(?, dst_tx), error = ? WHERE id = ?').run(status, dstTx ?? null, error ?? null, id);
  }
}

export function evmSide(args: { name: string; rpc: string; chainId: number; gasKey: string; teleport: string; confirmations: number; maxLogRange?: number }): Side {
  const provider = new JsonRpcProvider(args.rpc, args.chainId, { staticNetwork: true, cacheTimeout: -1 });
  return { name: args.name, chainId: args.chainId, provider, gas: new Wallet(args.gasKey, provider), teleport: args.teleport, confirmations: args.confirmations, maxLogRange: args.maxLogRange ?? 2000 };
}
