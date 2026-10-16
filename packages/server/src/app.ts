import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ApiPromise } from '@polkadot/api';
import type { DatabaseSync } from 'node:sqlite';
import { contentHash, PortionClient, RETENTION_BLOCKS, storedInBlock, type Deployment } from '@portion/sdk';
import { Faucet, FaucetError } from './faucet.js';
import { snapshot, recordSample, type NetworkSnapshot } from './network.js';
import { verifyListing } from './verify.js';

function sniff(data: Uint8Array): string {
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (data[0] === 0x89 && data[1] === 0x50) return 'image/png';
  if (data[0] === 0x52 && data[1] === 0x49 && data[8] === 0x57) return 'image/webp';
  if (data[0] === 0x7b) return 'application/json; charset=utf-8';
  if (new TextDecoder().decode(data.slice(0, 120)).includes('<svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

export function buildApp(ctx: { api: ApiPromise; db: DatabaseSync; deployment?: Deployment; faucet?: Faucet; startedAt: number }) {
  const { api, db, deployment, faucet } = ctx;
  const app = new Hono();
  app.use('*', cors());

  let netCache: { at: number; snap: NetworkSnapshot } | undefined;
  const network = async () => {
    if (netCache && Date.now() - netCache.at < 15_000) return netCache.snap;
    const snap = await snapshot(api);
    recordSample(db, snap);
    netCache = { at: Date.now(), snap };
    return snap;
  };

  app.get('/api/health', async (c) => {
    const head = (await api.rpc.chain.getHeader()).number.toNumber();
    return c.json({ ok: true, head, uptimeSeconds: Math.floor((Date.now() - ctx.startedAt) / 1000), deployed: !!deployment });
  });

  app.get('/api/deployment', (c) => c.json(deployment ?? null));

  // ───────── document gateway ─────────
  app.get('/api/doc/:hash', (c) => {
    const hash = c.req.param('hash').toLowerCase();
    const row = db.prepare('SELECT data FROM docs WHERE hash = ?').get(hash) as { data: Uint8Array } | undefined;
    if (!row) return c.json({ error: 'unknown document' }, 404);
    const bytes = new Uint8Array(row.data);
    if (contentHash(bytes) !== hash) return c.json({ error: 'stored bytes do not match their hash' }, 500);
    return new Response(bytes, { headers: { 'content-type': sniff(bytes), 'cache-control': 'public, max-age=31536000, immutable', 'x-content-hash': hash, 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox", 'access-control-allow-origin': '*' } });
  });

  // A client can pin the bytes it just stored, so a gateway that was offline at the time still ends up with them.
  // The server only accepts bytes it can find in the named block's body, so this cannot be used to host arbitrary files.
  app.post('/api/doc/:hash/pin', async (c) => {
    const hash = c.req.param('hash').toLowerCase();
    if (db.prepare('SELECT 1 FROM docs WHERE hash = ?').get(hash)) return c.json({ ok: true, already: true });
    const { block } = await c.req.json().catch(() => ({ block: 0 }));
    try {
      const bh = await api.rpc.chain.getBlockHash(Number(block));
      const found = (await storedInBlock(api, bh.toHex())).find((s) => s.hash === hash);
      if (!found) return c.json({ error: 'that block does not contain this document' }, 404);
      db.prepare('INSERT OR IGNORE INTO docs(hash, block, idx, size, data) VALUES (?,?,?,?,?)').run(found.hash, found.block, found.index, found.size, Buffer.from(found.data));
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: (e as Error).message }, 404);
    }
  });

  app.get('/api/doc/:hash/meta', async (c) => {
    const hash = c.req.param('hash').toLowerCase();
    const row = db.prepare('SELECT block, idx, size, renewed_block, renewed_idx FROM docs WHERE hash = ?').get(hash) as any;
    if (!row) return c.json({ error: 'unknown document' }, 404);
    const head = (await api.rpc.chain.getHeader()).number.toNumber();
    const anchor = row.renewed_block ?? row.block;
    const expiresAt = anchor + RETENTION_BLOCKS;
    return c.json({ hash, block: row.block, index: row.idx, size: row.size, renewedBlock: row.renewed_block, expiresAtBlock: expiresAt, blocksLeft: expiresAt - head, daysLeft: Math.max(0, (expiresAt - head) * 6) / 86_400, hashVerified: true });
  });

  // ───────── listings, proofs, activity ─────────
  const client = deployment ? new PortionClient(api, deployment) : undefined;

  app.get('/api/listings/:id/proof', async (c) => {
    if (!client) return c.json({ error: 'not deployed' }, 503);
    try {
      return c.json(await verifyListing(api, await client.listing(Number(c.req.param('id')))));
    } catch (e) {
      return c.json({ error: (e as Error).message }, 404);
    }
  });

  app.get('/api/activity', (c) => {
    const listing = c.req.query('listing');
    const actor = c.req.query('actor')?.toLowerCase();
    const limit = Math.min(Number(c.req.query('limit') ?? 30), 200);
    let sql = 'SELECT id, block, ts, kind, listing_id AS listingId, actor, data FROM events';
    const where: string[] = [];
    const args: any[] = [];
    if (listing !== undefined) { where.push('listing_id = ?'); args.push(Number(listing)); }
    if (actor) { where.push('actor = ?'); args.push(actor); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY id DESC LIMIT ?';
    args.push(limit);
    const rows = (db.prepare(sql).all(...args) as any[]).map((r) => ({ ...r, data: JSON.parse(r.data) }));
    return c.json(rows);
  });

  app.get('/api/listings/:id/revenue', (c) => {
    const id = Number(c.req.param('id'));
    const rows = db.prepare("SELECT ts, block, data FROM events WHERE listing_id = ? AND kind IN ('RevenueDeposited','Slashed') ORDER BY id").all(id) as any[];
    return c.json(rows.map((r) => {
      const d = JSON.parse(r.data);
      return { ts: r.ts, block: r.block, amount: d.net ?? d.toHolders ?? '0', kind: d.toHolders !== undefined ? 'slash' : 'revenue' };
    }));
  });

  // ───────── network ─────────
  app.get('/api/network', async (c) => c.json(await network()));
  app.get('/api/network/history', (c) => {
    const rows = db.prepare('SELECT ts,best,finalized,validators,block_time AS blockTime,peers FROM samples ORDER BY ts DESC LIMIT 288').all();
    return c.json((rows as any[]).reverse());
  });
  app.get('/api/keepers', (c) => {
    const rows = db.prepare('SELECT id, ts, kind, ref, ok, tx, detail FROM keeper_log ORDER BY id DESC LIMIT 60').all();
    return c.json(rows);
  });

  // ───────── faucet ─────────
  app.get('/api/faucet', async (c) => (faucet ? c.json(await faucet.status()) : c.json({ error: 'faucet disabled: no treasury key configured' }, 503)));
  app.post('/api/drip', async (c) => {
    if (!faucet) return c.json({ error: 'faucet disabled: no treasury key configured' }, 503);
    const body = await c.req.json().catch(() => ({}) as any);
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    try {
      return c.json(await faucet.drip(String(body.address ?? ''), ip));
    } catch (e) {
      if (e instanceof FaucetError) return c.json({ error: e.message }, e.status as any);
      return c.json({ error: (e as Error).message }, 500);
    }
  });

  // ───────── metrics (Prometheus text) for node operators ─────────
  app.get('/metrics', async (c) => {
    const s = await network();
    const lines = [
      '# HELP portaldot_best_block Best block number', '# TYPE portaldot_best_block gauge', `portaldot_best_block ${s.best}`,
      '# TYPE portaldot_finalized_block gauge', `portaldot_finalized_block ${s.finalized}`,
      '# TYPE portaldot_finality_lag gauge', `portaldot_finality_lag ${s.finalityLag}`,
      '# TYPE portaldot_block_time_seconds gauge', `portaldot_block_time_seconds ${s.blockTimeSec.toFixed(3)}`,
      '# TYPE portaldot_validators gauge', `portaldot_validators ${s.decentralization.validatorCount}`,
      '# TYPE portaldot_halt_set gauge', `portaldot_halt_set ${s.decentralization.haltSet}`,
      '# TYPE portaldot_peers gauge', `portaldot_peers ${s.peers}`,
      '# TYPE portaldot_dex_pools gauge', `portaldot_dex_pools ${s.modules.dexPools}`,
      '# TYPE portaldot_nomination_pools gauge', `portaldot_nomination_pools ${s.modules.nominationPools}`,
    ];
    return c.text(lines.join('\n') + '\n');
  });

  return app;
}
