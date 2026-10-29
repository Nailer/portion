// The sandbox backend: the same interface the live app uses, answered by the real Core v2 bytecode running in this
// browser (see chain.ts). Every page and dialog works unchanged; only where the money lives differs. Accounts are
// labelled roles with pretend balances, time moves only when the visitor skips it, and nothing reaches Portaldot.
import { coreDocument, coreListingView, refundableOf, validateControls, type CoreRecord, type Deployment, type ListingView, type PlanStep, type PositionView } from '@portion/sdk';
import { assetErc20Address, h160ToFallbackSs58, ss58ToH160 } from '@portion/sdk/addresses';
import { contentHash, MAX_DOC_BYTES } from '@portion/sdk/storage';
import { parseUnits, formatUnits } from '@portion/sdk/units';
import { keccak256, toUtf8Bytes } from 'ethers';
import { UserError, type ActionResult, type ActivityRow, type Backend, type Balances, type DripResult, type Intent, type Prepared, type Rules, type SandboxPersona, type TokenizeForm } from '../lib/backend';
import { SandboxChain, SANDBOX_PUSD_ID, TREASURY, DEPLOYER, labelAddress, loadOps, saveOps, type Op } from './chain';
import solarCover from './cover-solar.png?inline';
import coldCover from './cover-coldroom.png?inline';

const KEY = 'portion.sandbox.v1';
const U = 1_000_000n; // one pUSD
const DAY = 86_400, WEEK = 7 * DAY;
const ZERO = '0x0000000000000000000000000000000000000000';
const RULES: Rules = { saleFeeBps: 100, revenueFeeBps: 50, minBondBps: 500, slashTipBps: 100, minCadence: 60 };
const usd = (v: bigint) => `${formatUnits(v, 6, 2)} pUSD`;

const ROLES = [
  { key: 'operator', label: 'Operator', role: 'Runs the fictional asset: creates offers, requests escrow tranches and pays in revenue.', pusd: 10_000n },
  { key: 'reviewer', label: 'Reviewer', role: 'Independent checker named by the operator: opens the sale and approves each release.', pusd: 0n },
  { key: 'buyerA', label: 'Buyer A', role: 'Funds assets, stakes shares and claims deposited revenue.', pusd: 5_000n },
  { key: 'buyerB', label: 'Buyer B', role: 'A second funder, for challenges, refunds and split payouts.', pusd: 5_000n },
  { key: 'guardian', label: 'Guardian', role: 'Can pause new money for at most seven days. Never blocks claims or refunds.', pusd: 0n },
] as const;
export const personaAddress = (key: string) => labelAddress(key).toLowerCase();
const RECOVERY = labelAddress('recovery');

const fromBase64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const toBase64 = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const dataBytes = (url: string) => fromBase64(url.slice(url.indexOf(',') + 1));
const evidence = (text: string) => keccak256(toUtf8Bytes(text));

interface Saved { v: 1; genesis: number; ops: string; docs: Record<string, string> }
const storage = () => { try { return globalThis.localStorage; } catch { return undefined; } };

/** A fictional asset's public document, in the same format the live app hashes and publishes. */
function documents(assetId: number, form: { name: string; summary: string; category: number; terms: string; sharesForSale: number }, cover: Uint8Array) {
  const coverHash = contentHash(cover);
  const terms = new TextEncoder().encode(JSON.stringify({ v: 1, assetId, nftItem: assetId, nftCollection: 0, coverHash, sharesForSale: form.sharesForSale,
    name: form.name, summary: form.summary, category: form.category, terms: form.terms }));
  return { coverHash, terms, docHash: contentHash(terms) };
}

/** The opening state: funded roles, one asset already earning and one waiting for buyers. */
function seed(genesis: number) {
  const ops: Op[] = [], docs: Record<string, string> = {};
  const who = (key: string) => personaAddress(key);
  for (const role of ROLES) if (role.pusd) ops.push({ op: 'mint', asset: SANDBOX_PUSD_ID, to: who(role.key), amount: (role.pusd * U).toString() });
  const list = (assetId: number, form: { name: string; summary: string; category: number; terms: string; totalShares: number; sharesForSale: number; price: bigint; minimum: bigint; bond: bigint; minSold: number; days: number; tranches: number[] }, cover: string, now: number) => {
    const bytes = dataBytes(cover), doc = documents(assetId, form, bytes);
    docs[doc.docHash] = toBase64(doc.terms); docs[doc.coverHash] = toBase64(bytes);
    ops.push({ op: 'asset', asset: assetId }, { op: 'mint', asset: assetId, to: who('operator'), amount: String(form.totalShares) },
      { op: 'call', from: who('operator'), fn: 'create', approve: [{ asset: assetId, amount: String(form.sharesForSale) }, { asset: SANDBOX_PUSD_ID, amount: form.bond.toString() }],
        args: [{ asset: assetId, totalShares: BigInt(form.totalShares), forSale: BigInt(form.sharesForSale), cadence: BigInt(WEEK), price: form.price, minimum: form.minimum,
          bond: form.bond, docHash: doc.docHash, recovery: RECOVERY, reviewer: who('reviewer'), minSold: BigInt(form.minSold), deadline: BigInt(now + form.days * DAY), tranches: form.tranches }] },
      { op: 'call', from: who('reviewer'), fn: 'attest', args: [assetId, evidence(`Sandbox review of asset ${assetId}: site visit notes and photos (fictional)`)] });
  };
  let now = genesis;
  const skip = (seconds: number) => { ops.push({ op: 'skip', seconds }); now += seconds; };
  // 1. An asset that is already funded, has released its first tranche and has paid revenue twice.
  list(100_001, { name: 'Riverside Solar Canopy (fictional)', summary: 'A made-up 40 kW solar canopy over a market car park. It sells power to the market under a fictional agreement.', category: 0,
    terms: 'SANDBOX ONLY. This asset, its operator and its revenue are fictional. Holders who stake shares receive the deposited revenue pro rata, less the 0.5% Portion fee.',
    totalShares: 600, sharesForSale: 300, price: 10n * U, minimum: 30n * U, bond: 150n * U, minSold: 150, days: 14, tranches: [5_000, 5_000] }, solarCover, now);
  ops.push({ op: 'call', from: who('buyerA'), fn: 'buy', args: [100_001, 200n], approve: [{ asset: SANDBOX_PUSD_ID, amount: (2_000n * U).toString() }] },
    { op: 'call', from: who('buyerB'), fn: 'buy', args: [100_001, 100n], approve: [{ asset: SANDBOX_PUSD_ID, amount: (1_000n * U).toString() }] },
    { op: 'call', from: who('buyerB'), fn: 'finalize', args: [100_001] },
    { op: 'call', from: who('operator'), fn: 'propose', args: [100_001, evidence('Sandbox invoice: canopy frame and panels (fictional)')] },
    { op: 'call', from: who('reviewer'), fn: 'approve', args: [100_001] });
  skip(6 * DAY);
  ops.push({ op: 'call', from: who('operator'), fn: 'deposit', args: [100_001, 45n * U], approve: [{ asset: SANDBOX_PUSD_ID, amount: (45n * U).toString() }] });
  skip(DAY + DAY / 2);
  ops.push({ op: 'call', from: who('buyerA'), fn: 'release', args: [100_001] });
  skip(5 * DAY);
  ops.push({ op: 'call', from: who('operator'), fn: 'deposit', args: [100_001, 45n * U], approve: [{ asset: SANDBOX_PUSD_ID, amount: (45n * U).toString() }] });
  // 2. A new offer the visitor can fund, settle and follow through every escrow step.
  list(100_002, { name: 'Harbour Cold Room (fictional)', summary: 'A made-up refrigerated room rented by the day to fishing crews. Funding buys its compressor and insulation.', category: 2,
    terms: 'SANDBOX ONLY. This asset, its operator and its revenue are fictional. Payments are held by the contract and released in three reviewer-approved tranches. If fewer than 200 shares sell within 14 days, every buyer can take their money back.',
    totalShares: 1_000, sharesForSale: 400, price: 5n * U, minimum: 25n * U, bond: 150n * U, minSold: 200, days: 14, tranches: [4_000, 3_000, 3_000] }, coldCover, now);
  return { ops, docs };
}

export class SandboxBackend implements Backend {
  readonly mode = 'sandbox' as const;
  readonly chainLabel = 'Portion sandbox (simulated in this browser)';
  readonly deployed = true;
  readonly deployment: Deployment;
  readonly sandbox;
  private constructor(private chain: SandboxChain, private docs: Record<string, string>) {
    this.deployment = { contractVersion: 'core-v2', guardian: personaAddress('guardian'), network: 'sandbox', chainId: 0, portion: chain.portion,
      pusdAssetId: SANDBOX_PUSD_ID, deedsCollection: 0, treasury: h160ToFallbackSs58(TREASURY), deployer: h160ToFallbackSs58(DEPLOYER) };
    const personas: SandboxPersona[] = ROLES.map(role => {
      const h160 = personaAddress(role.key);
      return { key: role.key, label: role.label, role: role.role, passport: { pair: { sandbox: true } as never, address: h160ToFallbackSs58(h160), h160, kind: 'guest' } };
    });
    this.sandbox = {
      personas,
      started: chain.genesis,
      skip: async (seconds: number) => { const r = await chain.apply({ op: 'skip', seconds }); if (!r.ok) throw new UserError(r.error ?? 'Could not move the clock.'); this.save(); },
      addFunds: async (h160: string) => { await this.mint(h160); },
      pausedUntil: async () => Number(await chain.read('pausedUntil')),
    };
  }

  /** Opens the saved sandbox, or starts a fresh one from the seed if there is none or it cannot be replayed. */
  static async open(): Promise<SandboxBackend> {
    let saved: Saved | undefined;
    try { const text = storage()?.getItem(KEY); if (text) saved = JSON.parse(text); } catch { saved = undefined; }
    const guardian = personaAddress('guardian');
    if (saved?.v === 1) {
      try { return new SandboxBackend(await SandboxChain.create(saved.genesis, loadOps(saved.ops), guardian), saved.docs); }
      catch { /* An older or damaged save: start again rather than show a broken state. */ }
    }
    const genesis = Math.floor(Date.now() / 1000);
    const start = seed(genesis);
    const backend = new SandboxBackend(await SandboxChain.create(genesis, start.ops, guardian), start.docs);
    backend.save();
    return backend;
  }
  static reset() { try { storage()?.removeItem(KEY); } catch { /* nothing saved */ } }

  private save() {
    try { storage()?.setItem(KEY, JSON.stringify({ v: 1, genesis: this.chain.genesis, ops: saveOps(this.chain.ops), docs: this.docs } satisfies Saved)); }
    catch { /* Storage may be full or blocked; the sandbox keeps working until the page is closed. */ }
  }
  private async mint(h160: string, amount = 1_000n * U) {
    const r = await this.chain.apply({ op: 'mint', asset: SANDBOX_PUSD_ID, to: h160.toLowerCase(), amount: amount.toString() });
    if (!r.ok) throw new UserError(r.error ?? 'Could not add sandbox pUSD.');
    this.save();
    return r;
  }

  now() { return this.chain.now; }
  async head() { return this.chain.block; }
  async rules() { return RULES; }

  private catalog(): CoreRecord[] {
    return this.chain.events.filter(e => e.name === 'Listed').map(e => ({ assetId: Number(e.args.asset), docHash: String(e.args.docHash), createdAt: e.ts, block: e.block, txHash: e.txHash }));
  }
  private async view(record: CoreRecord): Promise<ListingView> {
    const [l, health, tranches] = await Promise.all([this.chain.read('listing', [record.assetId]), this.chain.read('health', [record.assetId]), this.chain.read('tranches', [record.assetId])]);
    const doc = coreDocument(await this.docJson(String(l.docHash)), record.assetId, 0);
    return coreListingView({ record, l, doc, health, tranches: Array.from(tranches), payToken: assetErc20Address(SANDBOX_PUSD_ID).toLowerCase(), now: this.chain.now });
  }
  async listings() { return Promise.all(this.catalog().map(record => this.view(record))); }
  async listing(id: number) {
    const record = this.catalog().find(r => r.assetId === id);
    if (!record) throw new UserError('There is no sandbox listing with that number.');
    return this.view(record);
  }
  async positions(address: string): Promise<PositionView[]> {
    const who = ss58ToH160(address);
    const rows = await Promise.all(this.catalog().map(async ({ assetId: id }) => {
      const [stake, pending, l, paid, taken] = await Promise.all([this.chain.read('stakes', [id, who]), this.chain.read('pending', [id, who]), this.chain.read('listing', [id]),
        this.chain.read('paid', [id, who]), this.chain.read('refundTaken', [id, who])]);
      return { id, staked: Number(stake.amount), pending: BigInt(pending), refundable: refundableOf(l, paid, taken) };
    }));
    return rows.filter(p => p.staked > 0 || p.pending > 0n || p.refundable > 0n);
  }
  async balances(address: string): Promise<Balances> { return { pot: 0n, pusd: await this.chain.tokenBalance(SANDBOX_PUSD_ID, ss58ToH160(address)) }; }
  shareBalance(assetId: number, address: string) { return this.chain.tokenBalance(assetId, ss58ToH160(address)); }
  async pool() { return null; }
  async quote() { return null; }
  docUrl(hash: string) { const doc = this.docs[hash.toLowerCase()] ?? this.docs[hash]; return doc ? `data:application/octet-stream;base64,${doc}` : ''; }
  async docMeta() { return null; }
  async docJson(hash: string) {
    const doc = this.docs[hash.toLowerCase()] ?? this.docs[hash];
    if (!doc) return null;
    const bytes = fromBase64(doc);
    return contentHash(bytes).toLowerCase() === hash.toLowerCase() ? JSON.parse(new TextDecoder().decode(bytes)) : null;
  }
  async proof() { return null; }
  async activity(q: { listing?: number; actor?: string; limit?: number }): Promise<ActivityRow[]> {
    const actor = q.actor?.toLowerCase();
    return this.chain.events
      .filter(e => (q.listing === undefined || Number(e.args.asset) === q.listing) && (!actor || e.from === actor))
      .slice().reverse().slice(0, q.limit ?? 200)
      .map(e => ({ id: e.id, txHash: e.txHash, block: e.block, ts: e.ts, listingId: e.args.asset === undefined ? null : Number(e.args.asset), actor: e.from,
        kind: e.name === 'Deposited' ? 'RevenueDeposited' : e.name === 'BondAdded' ? 'BondToppedUp' : e.name,
        data: e.name === 'Slashed' ? { ...e.args, toHolders: e.args.holders } : e.args }));
  }
  async revenue(id: number) {
    return this.chain.events.filter(e => Number(e.args.asset) === id && (e.name === 'Deposited' || e.name === 'Slashed'))
      .map(e => ({ ts: e.ts, amount: BigInt(String(e.name === 'Deposited' ? e.args.net : e.args.holders)), kind: e.name === 'Deposited' ? 'revenue' as const : 'slash' as const }));
  }
  async drip(address: string): Promise<DripResult> {
    const h160 = ss58ToH160(address);
    const r = await this.mint(h160);
    return { ss58: address, h160, viaEvm: true, tx: r.txHash, block: r.block, pot: '0', pusd: (1_000n * U).toString() };
  }

  // ───────────── actions ─────────────

  /** Wraps sandbox operations in the same review-then-confirm flow as the live app. Refusals show before confirming. */
  private async action(title: string, steps: PlanStep[], ops: Op[], cost?: string, listingId?: number, docs?: Record<string, string>): Promise<Prepared> {
    const dry = await this.chain.simulate(ops);
    if (!dry.ok) throw new UserError(dry.error ?? 'The contract refused this action.');
    return {
      title, steps, cost,
      run: async onStage => {
        onStage('broadcast', 'Running Core v2 in this browser');
        const out = await this.chain.batch(ops);
        if (!out.ok) return { ok: false, error: out.error };
        if (docs) Object.assign(this.docs, docs);
        this.save();
        onStage('done');
        return { ok: true, txHash: out.txHash, blockNumber: out.block, listingId } satisfies ActionResult;
      },
    };
  }

  async prepare(intent: Intent, who: { h160: string }): Promise<Prepared> {
    const me = who.h160.toLowerCase();
    const step = (fn: string, title: string, detail: string): PlanStep => ({ key: fn, lane: 'evm', pallet: 'Sandbox EVM', method: `PortionCoreV2.${fn}`, title, detail });
    const call = (fn: string, args: unknown[], approve?: { asset: number; amount: bigint }[]): Op =>
      ({ op: 'call', from: me, fn, args, approve: approve?.map(a => ({ asset: a.asset, amount: a.amount.toString() })) });
    const pusd = async (need: bigint) => {
      if (await this.chain.tokenBalance(SANDBOX_PUSD_ID, me) < need) throw new UserError(`This role holds less than ${usd(need)}. Use “Add 1,000 pUSD” in the sandbox bar.`, 'faucet');
    };
    switch (intent.kind) {
      case 'buy': {
        const l = await this.listing(intent.id);
        if (!l.saleOpen) throw new UserError(l.escrow?.phase === 'Pending' ? 'No one can buy until the named reviewer attests. Switch to the Reviewer.' : 'This sale is closed.');
        const cost = BigInt(intent.shares) * l.vault.salePrice;
        await pusd(cost);
        return this.action(`Buy ${intent.shares} share${intent.shares === 1 ? '' : 's'} of ${l.name}`,
          [step('buy', 'Pay into escrow and receive staked shares', 'Your payment is held by the contract, not paid to the operator. It is released in reviewer-approved tranches, or refunded if the raise misses its target.')],
          [call('buy', [intent.id, BigInt(intent.shares)], [{ asset: SANDBOX_PUSD_ID, amount: cost }])],
          `You pay ${usd(cost)}. The contract holds it and releases it to the operator only in reviewer-approved tranches; if the raise misses its target you can take it all back.`);
      }
      case 'claim':
        if (!intent.ids.length) throw new UserError('Nothing to claim yet.');
        return this.action(intent.ids.length === 1 ? 'Claim revenue' : `Claim revenue from ${intent.ids.length} listings`,
          [step('claim', 'Claim your deposited revenue', 'Pays the revenue allocated to your staked shares.')], intent.ids.map(id => call('claim', [id])));
      case 'deposit': {
        const l = await this.listing(intent.id);
        await pusd(intent.amount);
        const fee = intent.amount * BigInt(RULES.revenueFeeBps) / 10_000n;
        return this.action(`Deposit revenue into ${l.name}`, [step('deposit', 'Deposit business revenue', 'The fixed 0.5% fee is deducted; a qualifying operator payment resets the payment deadline.')],
          [call('deposit', [intent.id, intent.amount], [{ asset: SANDBOX_PUSD_ID, amount: intent.amount }])],
          `Deposit ${usd(intent.amount)} including ${usd(fee)} fee. ${usd(intent.amount - fee)} goes to holders with staked shares, or is held in reserve for them if none are staked.`);
      }
      case 'stake':
        return this.action('Stake shares to earn', [step('stake', 'Stake shares', 'Staked shares receive their portion of every later deposit.')],
          [call('stake', [intent.id, BigInt(intent.amount)], [{ asset: intent.id, amount: BigInt(intent.amount) }])]);
      case 'unstake':
        return this.action('Unstake shares', [step('unstake', 'Take shares out of the vault', 'Returns share tokens to your wallet. Revenue already allocated stays claimable.')], [call('unstake', [intent.id, BigInt(intent.amount)])]);
      case 'slash':
        return this.action('Slash the operator bond', [step('slash', 'Slash the bond of a defaulted operator', 'The caller receives 1% of the bond; the rest goes to staked holders or is held in reserve for them. If escrow is still held, refunds open.')],
          [call('slash', [intent.id])], 'The contract decides the caller tip and what holders receive.');
      case 'topUp':
        await pusd(intent.amount);
        return this.action('Top up the bond', [step('topUp', 'Top up the operator bond', 'Adds pUSD to the bond held by the contract.')],
          [call('topUp', [intent.id, intent.amount], [{ asset: SANDBOX_PUSD_ID, amount: intent.amount }])]);
      case 'operator': {
        if (intent.fn === 'closeSale') throw new UserError('Core v2 settles a sale with finalize, not closeSale.');
        const copy = intent.fn === 'windDown' ? ['Wind the listing down', 'Closes the listing after notice, once nothing is staked or held for holders.'] : ['Withdraw the bond', 'Returns the remaining bond after the waiting period.'];
        return this.action(copy[0], [step(intent.fn, copy[0], copy[1])], [call(intent.fn, [intent.id])]);
      }
      case 'escrow': {
        const id = intent.id, ev = intent.evidence ?? '';
        const needsEvidence = intent.fn === 'attest' || intent.fn === 'propose';
        if (needsEvidence && !/^0x[0-9a-f]{64}$/i.test(ev)) throw new UserError('Attach the evidence file first. Only its hash is recorded.');
        const copy: Record<string, [string, string]> = {
          attest: ['Record your review', 'Opens the sale. Your address and evidence hash are recorded on-chain.'],
          finalize: ['Settle the raise', 'Anyone may settle once the offer sells out or the deadline passes. A missed target opens full refunds.'],
          refund: ['Take back your payment', 'Returns your share of the purchase money the operator never received.'],
          cancel: ['Cancel the raise', 'Returns every unreleased payment to buyers. Money already released cannot be recovered.'],
          propose: ['Request the next tranche', 'The reviewer must approve, then holders have one period to challenge.'],
          approve: ['Approve the tranche', 'Starts the one-period challenge window.'],
          challenge: ['Challenge the tranche', 'Needs at least 10% of sold shares staked. Two failed tranches return the unreleased money to buyers.'],
          release: ['Release the tranche', 'Pays the approved share of escrow to the operator, less the 1% sale fee.'],
          lapse: ['Clear the failed tranche', 'A second failure opens refunds of unreleased money.'],
          noticeWindDown: ['Give notice of wind-down', 'Holders get two periods to respond before the listing can close.'],
        };
        const [title, detail] = copy[intent.fn];
        return this.action(title, [step(intent.fn, title, detail)], [call(intent.fn, needsEvidence ? [id, ev] : [id])]);
      }
      case 'guardian': {
        const [title, detail] = intent.fn === 'pause'
          ? ['Pause new money for seven days', 'Stops creating, attesting, buying, proposing and releasing. Claims, unstaking, refunds, deposits, challenges and slashes keep working. The next pause must wait seven more days.']
          : ['Lift the pause', 'New money can flow again at once.'];
        return this.action(title, [step(intent.fn, title, detail)], [call(intent.fn, [])]);
      }
      case 'dexSeed': case 'dexBuy': case 'dexSell':
        throw new UserError('Share markets use Portaldot’s native asset-conversion pallet, which the sandbox does not simulate.');
      case 'tokenize':
        return this.prepareTokenize(intent.form, me);
    }
  }

  private async prepareTokenize(f: TokenizeForm, me: string): Promise<Prepared> {
    if (!f.controls) throw new UserError('Name the reviewer, the funding target, the deadline and the release schedule.');
    const price = parseUnits(f.pricePusd, 6), bond = parseUnits(f.bondPusd, 6), minimum = parseUnits(f.minPerPeriodPusd, 6);
    const ids = new Set(this.catalog().map(r => r.assetId));
    let assetId = 100_001; while (ids.has(assetId)) assetId++;
    const cover = f.image?.bytes ?? dataBytes(coldCover);
    if (cover.length > MAX_DOC_BYTES) throw new UserError('The compressed photo exceeds the document limit.');
    const doc = documents(assetId, { ...f, sharesForSale: f.sharesForSale }, cover);
    if (doc.terms.length > MAX_DOC_BYTES) throw new UserError('The terms exceed the document limit.');
    const deadline = this.chain.now + f.controls.deadlineDays * DAY;
    const input = { name: f.name, summary: f.summary, category: f.category, totalShares: f.totalShares, sharesForSale: f.sharesForSale, salePrice: price, cadence: f.cadenceSeconds,
      minPerPeriod: minimum, bond, docHash: doc.docHash, coverHash: doc.coverHash,
      controls: { reviewer: f.controls.reviewer, recovery: f.controls.recovery || undefined, minSold: f.controls.minSold, deadline, tranches: f.controls.tranches } };
    let controls;
    try { controls = validateControls(input, me, this.chain.now); } catch (e) { throw new UserError((e as Error).message); }
    if (bond * 10_000n < BigInt(f.sharesForSale) * price * BigInt(RULES.minBondBps)) throw new UserError(`The bond must be at least ${RULES.minBondBps / 100}% of the raise.`);
    if (await this.chain.tokenBalance(SANDBOX_PUSD_ID, me) < bond) throw new UserError(`This role holds less than the ${usd(bond)} bond. Use “Add 1,000 pUSD” in the sandbox bar.`, 'faucet');
    const terms = { asset: assetId, totalShares: BigInt(f.totalShares), forSale: BigInt(f.sharesForSale), cadence: BigInt(f.cadenceSeconds), price, minimum, bond, docHash: doc.docHash,
      recovery: controls.recovery, reviewer: controls.reviewer, minSold: BigInt(f.controls.minSold), deadline: BigInt(deadline), tranches: f.controls.tranches };
    const ops: Op[] = [{ op: 'asset', asset: assetId }, { op: 'mint', asset: assetId, to: me, amount: String(f.totalShares) },
      { op: 'call', from: me, fn: 'create', args: [terms], approve: [{ asset: assetId, amount: String(f.sharesForSale) }, { asset: SANDBOX_PUSD_ID, amount: bond.toString() }] }];
    return this.action(`Tokenize ${f.name}`, [
      { key: 'shares', lane: 'native', pallet: 'Sandbox', method: 'mint', title: `Create ${f.totalShares.toLocaleString()} share tokens`, detail: 'On Portaldot this is a native deed NFT fractionalized into an asset. The sandbox mints a stand-in token at the same address.' },
      { key: 'create', lane: 'evm', pallet: 'Sandbox EVM', method: 'PortionCoreV2.create', title: 'Escrow the offered shares and bond, and register the terms', detail: 'No sale opens until the named reviewer attests.' },
    ], ops, `Lock ${usd(bond)} as the operator bond. Sandbox pUSD has no value.`, assetId,
    { [doc.docHash]: toBase64(doc.terms), [doc.coverHash]: toBase64(cover) });
  }
}
