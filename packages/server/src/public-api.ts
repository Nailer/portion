import { Hono } from 'hono';
import { list, put } from '@vercel/blob';
import { Interface } from 'ethers';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady, decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import {
  connect, TESTNET, PortionCoreArtifact, ReviveContract, storedInBlock, contentHash, MAX_DOC_BYTES,
  coreDocument, CoreClient, nativeFree, submit, ss58ToH160, decodeFailure, UnconfirmedTransactionError, type Deployment, type CoreRecord,
} from '@portion/sdk';
import type { ApiPromise } from '@polkadot/api';
import { verifyListing } from './verify.js';
import { storedJson } from './blob-pages.js';
import { revenueCoverage } from './receipt-coverage.js';
import { blobCreditStore, reserveCredits } from './credit-control.js';

interface Receipt { block: number; ts: number; txHash: string; rows: { kind: string; listingId: number; actor: string | null; data: Record<string, unknown> }[] }
const HASH = /^0x[0-9a-f]{64}$/i;
const jsonSafe = (value: unknown) => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
const imageType = (data: Uint8Array) => data[0] === 0xff && data[1] === 0xd8 ? 'image/jpeg' : data[0] === 0x89 && data[1] === 0x50 ? 'image/png' : data[0] === 0x52 && data[8] === 0x57 ? 'image/webp' : 'application/json';

/** Stateless Vercel routes with durable, content-addressed public copies of verified chain data. No deployment keys; test credits use a separate, limited issuer. */
export function publicApi(deployment: Deployment | undefined, createConnection: () => Promise<ApiPromise> = () => connect(TESTNET.ws)) {
  const app = new Hono();
  const prefix = `portion/core-v1/${deployment?.portion.toLowerCase() ?? 'undeployed'}/`;
  const read = async (path: string): Promise<Uint8Array | null> => {
    const result = await list({ prefix: prefix + path, limit: 2 });
    const blob = result.blobs.find(blob => blob.pathname === prefix + path);
    if (!blob) return null;
    const response = await fetch(blob.url);
    if (!response.ok) throw new Error('Public storage is unavailable.');
    return new Uint8Array(await response.arrayBuffer());
  };
  const write = async (path: string, bytes: Uint8Array, type = 'application/json', allowOverwrite = false) => {
    await put(prefix + path, Buffer.from(bytes), { access: 'public', addRandomSuffix: false, allowOverwrite, contentType: type });
  };
  const readDoc = async (hash: string) => {
    if (!HASH.test(hash)) throw new Error('Invalid content hash.');
    const bytes = await read(`docs/${hash}`);
    if (!bytes || bytes.length > MAX_DOC_BYTES || contentHash(bytes).toLowerCase() !== hash.toLowerCase()) throw new Error('Verified document unavailable.');
    return bytes;
  };
  const catalog = async (): Promise<CoreRecord[]> => {
    return storedJson<CoreRecord>(prefix + 'catalog/');
  };
  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    if (!deployment || deployment.contractVersion !== 'core-v1') return c.json({ error: 'Core contracts are not deployed.' }, 503);
    if (!process.env.BLOB_READ_WRITE_TOKEN) return c.json({ error: 'Durable public document storage is not configured.' }, 503);
    return next();
  });
  const chain = async <T>(run: (api: ApiPromise) => Promise<T>): Promise<T> => {
    const api = await createConnection();
    try {
      if (api.genesisHash.toHex() !== '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd') throw new Error('Unexpected network.');
      return await run(api);
    } finally { await api.disconnect(); }
  };
  app.get('/api/deployment', c => c.json(deployment));
  app.get('/api/health', async c => { await list({ prefix, limit: 1 }); return c.json({ ok: true, deployed: true, mode: 'core-v1-public-receipts', indexedHistoryComplete: false,
    documents: true, note: 'Receipts submitted by the app are verified and retained; this is not a complete archive of outside transactions.' }); });
  app.get('/api/catalog', async c => {
    c.header('Cache-Control', 'private, no-store'); return c.json(await catalog());
  });
  app.get('/api/doc/:hash', async c => {
    const bytes = await readDoc(c.req.param('hash'));
    return new Response(bytes, { headers: { 'content-type': imageType(bytes), 'cache-control': 'public,max-age=31536000,immutable', 'content-security-policy': "default-src 'none'; sandbox", 'x-content-type-options': 'nosniff' } });
  });
  app.get('/api/doc/:hash/meta', async c => {
    const hash = c.req.param('hash'); await readDoc(hash);
    const bytes = await read(`anchors/${hash}`);
    if (!bytes) return c.json({ error: 'Storage anchor unavailable.' }, 503);
    const anchor = JSON.parse(new TextDecoder().decode(bytes));
    return chain(async api => { const finalized = await api.rpc.chain.getFinalizedHead(); const head = (await api.rpc.chain.getHeader(finalized)).number.toNumber(); return c.json({ ...anchor, verifiedAtBlock: head, blocksLeft: anchor.expiresAtBlock - head }); });
  });
  app.post('/api/doc/:hash/pin', async c => {
    const hash = c.req.param('hash'); if (!HASH.test(hash)) return c.json({ error: 'Invalid hash.' }, 400);
    const body = await c.req.json();
    if (!Number.isSafeInteger(body.block) || body.block < 1) return c.json({ error: 'Finalized block is required.' }, 400);
    const existing = await read(`docs/${hash}`);
    if (existing && contentHash(existing).toLowerCase() !== hash.toLowerCase()) throw new Error('Stored document content is inconsistent.');
    if (existing && await read(`anchors/${hash}`)) return c.json({ ok: true, already: true });
    return chain(async api => {
      const finalized = await api.rpc.chain.getFinalizedHead();
      const head = (await api.rpc.chain.getHeader(finalized)).number.toNumber();
      if (body.block > head) return c.json({ error: 'Block is not finalized.' }, 409);
      const blockHash = await api.rpc.chain.getBlockHash(body.block);
      const found = (await storedInBlock(api, blockHash.toHex())).find(item => item.hash.toLowerCase() === hash.toLowerCase());
      if (!found || found.size > MAX_DOC_BYTES) return c.json({ error: 'Accepted document not found in this block.' }, 404);
      if (!existing) await write(`docs/${hash}`, found.data, imageType(found.data));
      await write(`anchors/${hash}`, new TextEncoder().encode(JSON.stringify({ hash, block: found.block, index: found.index, size: found.size, finalizedHash: blockHash.toHex(), verifiedAtBlock: head, expiresAtBlock: found.block + 100800, blocksLeft: found.block + 100800 - head })));
      return c.json({ ok: true });
    });
  });
  const receiptList = async (): Promise<Receipt[]> => {
    return storedJson<Receipt>(prefix + 'receipts/');
  };
  app.post('/api/receipts', async c => {
    const input = await c.req.json();
    if (!Number.isSafeInteger(input.block) || input.block < 1 || !HASH.test(input.txHash)) return c.json({ error: 'A block and transaction hash are required.' }, 400);
    const path = `receipts/${input.txHash.toLowerCase()}`;
    if (await read(path)) return c.json({ ok: true, already: true });
    return chain(async api => {
      const finalized = await api.rpc.chain.getFinalizedHead();
      if (input.block > (await api.rpc.chain.getHeader(finalized)).number.toNumber()) return c.json({ error: 'Block is not finalized.' }, 409);
      const hash = await api.rpc.chain.getBlockHash(input.block);
      const [body, at] = await Promise.all([api.rpc.chain.getBlock(hash), api.at(hash)]);
      const index = body.block.extrinsics.findIndex(tx => tx.hash.toHex().toLowerCase() === input.txHash.toLowerCase());
      if (index < 0) return c.json({ error: 'Transaction is not in that finalized block.' }, 404);
      const records: any = await at.query.system.events();
      const own = [...records].filter((record: any) => record.phase.isApplyExtrinsic && record.phase.asApplyExtrinsic.toNumber() === index);
      if (own.some((record: any) => api.events.system.ExtrinsicFailed.is(record.event))) return c.json({ error: 'Transaction failed.' }, 400);
      const iface = new Interface(PortionCoreArtifact.abi);
      const ts = Math.floor(Number((await at.query.timestamp.now()).toString()) / 1000);
      const rows: Receipt['rows'] = [];
      for (const record of own) {
        if (!api.events.revive.ContractEmitted.is(record.event)) continue;
        const [address, data, topics]: any = record.event.data;
        if (address.toHex().toLowerCase() !== deployment!.portion.toLowerCase()) continue;
        const event = iface.parseLog({ data: data.toHex(), topics: topics.map((topic: any) => topic.toHex()) });
        if (!event) throw new Error('Core event could not be decoded.');
        const args = jsonSafe(Object.fromEntries(event.fragment.inputs.map((field, i) => [field.name, event.args[i]])));
        const actor = args.operator ?? args.buyer ?? args.account ?? args.from ?? null;
        const aliases: Record<string, string> = { Deposited: 'RevenueDeposited', BondAdded: 'BondToppedUp' };
        rows.push({ kind: aliases[event.name] ?? event.name, listingId: Number(args.asset), actor: actor ? String(actor).toLowerCase() : null,
          data: { ...args, ...(args.holders !== undefined ? { toHolders: args.holders } : {}) } });
        if (event.name === 'Listed') {
          const l = await new ReviveContract(api, deployment!.portion, PortionCoreArtifact.abi).read('listing', [args.asset]);
          if (String(l.docHash).toLowerCase() !== String(args.docHash).toLowerCase()) throw new Error('Listing hash differs from event.');
          coreDocument(JSON.parse(new TextDecoder().decode(await readDoc(String(l.docHash)))), Number(args.asset), deployment!.deedsCollection);
          const entry: CoreRecord = { assetId: Number(args.asset), docHash: String(l.docHash), createdAt: ts, block: input.block, txHash: input.txHash };
          if (!(await read(`catalog/${args.asset}`))) await write(`catalog/${args.asset}`, new TextEncoder().encode(JSON.stringify(entry)));
        }
      }
      if (!rows.length) return c.json({ error: 'No Portion events were emitted by this transaction.' }, 400);
      await write(path, new TextEncoder().encode(JSON.stringify({ block: input.block, ts, txHash: input.txHash, rows })));
      return c.json({ ok: true });
    });
  });
  app.get('/api/activity', async c => {
    const listing = c.req.query('listing'); const actor = c.req.query('actor')?.toLowerCase();
    const rows = (await receiptList()).flatMap(receipt => receipt.rows.map((row, i) => ({ ...row, id: `${receipt.txHash}:${i}`, block: receipt.block, ts: receipt.ts, txHash: receipt.txHash })));
    return c.json(rows.filter(row => (listing === undefined || row.listingId === Number(listing)) && (!actor || row.actor === actor)).sort((a, b) => b.block - a.block).slice(0, 200));
  });
  app.get('/api/transactions/:hash', async c => {
    const txHash = c.req.param('hash'); const block = Number(c.req.query('block'));
    if (!HASH.test(txHash) || !Number.isSafeInteger(block) || block < 1) return c.json({ error: 'An actual transaction hash and block number are required.' }, 400);
    c.header('Cache-Control', 'private, no-store');
    return chain(async api => {
      const final = await api.rpc.chain.getFinalizedHead();
      if (block > (await api.rpc.chain.getHeader(final)).number.toNumber()) return c.json({ error: 'This block is not finalized yet.' }, 409);
      const hash = await api.rpc.chain.getBlockHash(block);
      const [body, at] = await Promise.all([api.rpc.chain.getBlock(hash), api.at(hash)]);
      const index = body.block.extrinsics.findIndex(tx => tx.hash.toHex().toLowerCase() === txHash.toLowerCase());
      if (index < 0) return c.json({ error: 'Transaction not found in that block. Its overall outcome remains unknown; do not infer failure or retry.' }, 404);
      const records: any = await at.query.system.events();
      const events = [...records].filter((record: any) => record.phase.isApplyExtrinsic && record.phase.asApplyExtrinsic.toNumber() === index);
      const success = events.some(record => at.events.system.ExtrinsicSuccess.is(record.event));
      const failure = decodeFailure(at as unknown as ApiPromise, events);
      if (!success && !failure) return c.json({ error: 'A final dispatch outcome could not be verified.' }, 503);
      const tx = body.block.extrinsics[index];
      return c.json({ finalized: true, ok: success && !failure, txHash: txHash.toLowerCase(), blockNumber: block, blockHash: hash.toHex(), callHash: tx.method.hash.toHex(), nonce: tx.nonce.toString(), signer: tx.isSigned ? tx.signer.toString() : null, ...(failure ? { error: failure } : {}) });
    });
  });
  app.get('/api/listings/:id/revenue', async c => {
    const id = Number(c.req.param('id'));
    const rows = (await receiptList()).flatMap(receipt => receipt.rows.filter(row => row.listingId === id && ['RevenueDeposited', 'Slashed'].includes(row.kind))
      .map(row => ({ ts: receipt.ts, amount: String(row.data.net ?? row.data.toHolders ?? '0'), kind: row.kind === 'Slashed' ? 'slash' : 'revenue' })));
    return c.json(rows.sort((a, b) => a.ts - b.ts));
  });
  app.get('/api/listings/:id/history', async c => {
    const id = Number(c.req.param('id'));
    if (!Number.isSafeInteger(id) || id < 0) return c.json({ error: 'A native asset identifier is required.' }, 400);
    c.header('Cache-Control', 'private, no-store');
    return chain(async api => {
      const hash = await api.rpc.chain.getFinalizedHead();
      const header = await api.rpc.chain.getHeader(hash);
      const at = await api.at(hash);
      const listing = await new ReviveContract(at as unknown as ApiPromise, deployment!.portion, PortionCoreArtifact.abi).read('listing', [id]);
      return c.json({ ...revenueCoverage(await receiptList(), id, BigInt(listing.revenue), header.number.toNumber()), finalizedHash: hash.toHex() });
    });
  });
  app.get('/api/listings/:id/proof', async c => chain(async api => {
    const client = new CoreClient(api, deployment!, { catalog, document: async hash => JSON.parse(new TextDecoder().decode(await readDoc(hash))) });
    return c.json(await verifyListing(api, await client.listing(Number(c.req.param('id')))));
  }));
  const creditIssuer = async () => {
    const mnemonic = process.env.PUSD_FAUCET_MNEMONIC;
    if (!mnemonic) throw new Error('Test-credit service is not configured.');
    await cryptoWaitReady();
    return new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(mnemonic);
  };
  const day = () => new Date().toISOString().slice(0, 10);
  const creditControl = blobCreditStore(prefix + 'credit-control/v2.json');
  app.get('/api/faucet', async c => chain(async api => {
    const issuer = await creditIssuer();
    const funds = await nativeFree(api, issuer.address);
    if (funds < 25n * 10n ** 12n) return c.json({ error: 'Test-credit service gas reserve is low.' }, 503);
    const claims = await list({ prefix: prefix + `credits/${day()}/`, limit: 21 });
    const control = await creditControl.load();
    const used = Math.max(claims.blobs.length, control?.state.day === day() ? control.state.attempts : 0);
    return c.json({ address: issuer.address, balance: funds.toString(), dripPot: '0', dripPusd: '500000000',
      cooldownSeconds: Math.ceil((Date.parse(day() + 'T00:00:00Z') + 86400000 - Date.now()) / 1000), remainingToday: Math.max(0, 20 - used),
      reset: 'UTC midnight', nativeFaucetEnabled: false, pending: !!control?.state.pending, attemptLimit: 20 });
  }));
  app.post('/api/drip', async c => {
    const input = await c.req.json();
    let address: string;
    try { const bytes = decodeAddress(input.address); if (bytes.length !== 32) throw new Error(); address = encodeAddress(bytes, 42); }
    catch { return c.json({ error: 'Connect a native wallet and use its public address.' }, 400); }
    return chain(async api => {
      const issuer = await creditIssuer();
      const asset: any = (await api.query.assets.asset(deployment!.pusdAssetId)).toJSON();
      if (asset?.issuer !== issuer.address) return c.json({ error: 'Test-credit issuer permission is unavailable.' }, 503);
      if (await nativeFree(api, address) === 0n) return c.json({ error: 'Fund this account with tPOT from the official testnet faucet first. Native tokens are needed for its transactions and storage deposits.' }, 400);
      const requestDay = day();
      const path = `credits/${requestDay}/${address}`;
      if (await read(path)) return c.json({ error: 'This account already requested credits today. Check its on-chain balance and try again after UTC midnight.' }, 429);
      const claims = await list({ prefix: prefix + `credits/${requestDay}/`, limit: 21 });
      if (claims.blobs.length >= 20) return c.json({ error: 'Daily test-credit request limit reached.' }, 429);
      const tx = api.tx.assets.mint(deployment!.pusdAssetId, address, 500_000_000n);
      let lease: Awaited<ReturnType<typeof reserveCredits>>;
      try { lease = await reserveCredits(creditControl, address, requestDay, claims.blobs.map(blob => blob.pathname.split('/').at(-1)!)); }
      catch (error) { return c.json({ error: error instanceof Error ? error.message : 'Credit reservation is busy. No mint was submitted by this request.' }, 429); }
      // Reserve before quoting or signing. A crash/unknown mint keeps the lock, even across UTC midnight.
      let signingStarted = false;
      try {
        const fee = BigInt((await tx.paymentInfo(issuer.address)).partialFee.toString());
        if (fee > 5n * 10n ** 12n || await nativeFree(api, issuer.address) < fee + 25n * 10n ** 12n) {
          await lease.finish(); return c.json({ error: 'Test-credit service budget is unavailable. This attempt is reserved for today; no mint was submitted.' }, 503);
        }
        await write(path, new TextEncoder().encode(JSON.stringify({ status: 'pending', address, requestedAt: new Date().toISOString() })));
        signingStarted = true;
        const out = await submit(api, tx, issuer);
        await write(path, new TextEncoder().encode(JSON.stringify({ status: out.ok ? 'finalized' : 'failed', address, tx: out.txHash, block: out.blockNumber })), 'application/json', true);
        await lease.finish();
        if (!out.ok) return c.json({ error: `Credit issuance failed on-chain: ${out.error}. Keep hash ${out.txHash}. This attempt counts toward today's quota.` }, 503);
        return c.json({ ss58: address, h160: ss58ToH160(address), viaEvm: false, tx: out.txHash, block: out.blockNumber, pot: '0', pusd: '500000000' });
      } catch (error) {
        if (!signingStarted) { try { await lease.finish(); } catch { /* A retained lock is safer than another mint. */ } }
        return c.json({ error: `Credit request could not be completed. ${signingStarted ? 'Its outcome may be unknown; issuance is paused for reconciliation. Do not retry.' : 'No mint was submitted. The reserved attempt remains counted.'} ${error instanceof UnconfirmedTransactionError && error.txHash ? `Keep hash ${error.txHash}.` : ''}` }, 503);
      }
    });
  });
  app.get('/api/teleport/config', c => c.json({ enabled: false }));
  app.onError((error, c) => { console.error('[public-api]', error.message); return c.json({ error: 'Verified data could not be retrieved or published. Please retry; no substitute data was generated.' }, 503); });
  app.notFound(c => c.json({ error: 'Service route unavailable.' }, 404));
  return app;
}
