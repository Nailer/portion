import type { ApiPromise } from '@polkadot/api';
import type { KeyringPair } from '@polkadot/keyring/types';
import type { DatabaseSync } from 'node:sqlite';
import { decodeAddress } from '@polkadot/util-crypto';
import { h160ToFallbackSs58, isH160, nativeFree, submit, ss58ToH160, type Deployment } from '@portion/sdk';
import { config } from './config.js';

export class FaucetError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Accepts either a Substrate address or a MetaMask-style 0x address and returns the account to fund. */
export function resolveTarget(input: string): { ss58: string; h160: string; viaEvm: boolean } {
  const s = input.trim();
  if (isH160(s)) {
    const ss58 = h160ToFallbackSs58(s);
    return { ss58, h160: s.toLowerCase(), viaEvm: true };
  }
  try {
    decodeAddress(s);
  } catch {
    throw new FaucetError('That does not look like a Portaldot (SS58) or 0x address.');
  }
  return { ss58: s, h160: ss58ToH160(s), viaEvm: false };
}

export class Faucet {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private api: ApiPromise,
    private db: DatabaseSync,
    private treasury: KeyringPair,
    private deployment: Deployment | undefined,
  ) {}

  async status() {
    const free = await nativeFree(this.api, this.treasury.address);
    const day = Math.floor(Date.now() / 1000) - 86_400;
    const used = (this.db.prepare('SELECT COUNT(*) c FROM drips WHERE ts > ?').get(day) as { c: number }).c;
    return {
      address: this.treasury.address,
      balance: free.toString(),
      dripPot: config.drip.pot.toString(),
      dripPusd: this.deployment ? config.drip.pusd.toString() : '0',
      cooldownSeconds: config.drip.cooldownSeconds,
      remainingToday: Math.max(0, config.drip.globalPerDay - used),
    };
  }

  drip(input: string, ip = 'unknown') {
    // serialise: one transfer at a time keeps nonces simple and the treasury safe
    const run = this.queue.then(() => this.doDrip(input, ip));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async doDrip(input: string, ip: string) {
    const target = resolveTarget(input);
    const now = Math.floor(Date.now() / 1000);

    const last = this.db.prepare('SELECT ts FROM drips WHERE address = ? ORDER BY ts DESC LIMIT 1').get(target.ss58) as { ts: number } | undefined;
    if (last && now - last.ts < config.drip.cooldownSeconds) {
      const wait = config.drip.cooldownSeconds - (now - last.ts);
      throw new FaucetError(`This account already received tokens. Try again in ${Math.ceil(wait / 3600)}h.`, 429);
    }
    const dayAgo = now - 86_400;
    const ipCount = (this.db.prepare('SELECT COUNT(*) c FROM drips WHERE ip = ? AND ts > ?').get(ip, dayAgo) as { c: number }).c;
    if (ip !== 'unknown' && ipCount >= config.drip.perIpPerDay) throw new FaucetError('Too many requests from this network today.', 429);
    const total = (this.db.prepare('SELECT COUNT(*) c FROM drips WHERE ts > ?').get(dayAgo) as { c: number }).c;
    if (total >= config.drip.globalPerDay) throw new FaucetError('The faucet hit its daily limit. Try again tomorrow.', 429);

    const free = await nativeFree(this.api, this.treasury.address);
    if (free < config.drip.pot * 20n) throw new FaucetError('The faucet is nearly empty. Please tell the team.', 503);

    const calls: any[] = [this.api.tx.balances.transferKeepAlive(target.ss58, config.drip.pot)];
    if (this.deployment) calls.push(this.api.tx.assets.transfer(this.deployment.pusdAssetId, target.ss58, config.drip.pusd));
    const tx = calls.length === 1 ? calls[0] : this.api.tx.utility.batchAll(calls);
    const out = await submit(this.api, tx, this.treasury);
    if (!out.ok) throw new FaucetError(`Transfer failed on-chain: ${out.error}`, 502);

    this.db
      .prepare('INSERT INTO drips(ts,address,ip,pot,pusd,tx) VALUES (?,?,?,?,?,?)')
      .run(now, target.ss58, ip, config.drip.pot.toString(), this.deployment ? config.drip.pusd.toString() : '0', out.txHash);
    return {
      ...target,
      tx: out.txHash,
      block: out.blockNumber,
      pot: config.drip.pot.toString(),
      pusd: this.deployment ? config.drip.pusd.toString() : '0',
    };
  }
}
