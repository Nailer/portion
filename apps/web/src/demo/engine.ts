import { generateCover, parseUnits, HEALTH, assetErc20Address, type Deployment, type ListingView, type Passport, type PlanStep, type PositionView } from '@portion/sdk';
import type { ActionResult, ActivityRow, Backend, Balances, DocMeta, DripResult, Intent, PoolView, Prepared, ProofView, Rules, StageName, TokenizeForm } from '../lib/backend';
import { UserError } from '../lib/backend';

/**
 * A faithful in-memory copy of the Portion contract rules (see contracts/src/Portion.sol) behind the same Backend
 * interface as the live chain. It exists so the app can be explored when the testnet is unreachable, and it is always
 * labelled "Simulated". It never claims to be on-chain.
 */
const PRECISION = 10n ** 18n;
const U = (n: number) => BigInt(Math.round(n * 1e6));

interface SimStake { amount: bigint; debt: bigint; owed: bigint }
interface SimListing extends Omit<ListingView, 'vault' | 'health'> {
  vault: ListingView['vault'];
  stakes: Map<string, SimStake>;
  operatorAddr: string;
}

const RULES: Rules = { saleFeeBps: 100, revenueFeeBps: 50, minBondBps: 500, slashTipBps: 100, minCadence: 60 };

const SEEDS: { name: string; summary: string; category: number; shares: number; forSale: number; price: number; cadence: number; minPer: number; terms: string }[] = [
  { name: 'Solar charging network', summary: 'Solar-powered charging hubs serving daily customers across a neighbourhood.', category: 0, shares: 1000, forSale: 600, price: 12, cadence: 7 * 86_400, minPer: 90, terms: 'Operator reports takings weekly and pays 70% of net into the vault. Panel and inverter are insured. Bond slashed after two missed weeks.' },
  { name: 'Urban electric bike fleet', summary: 'Six e-bikes leased to riders on a daily fee. Fixed charging station on site.', category: 1, shares: 2400, forSale: 1800, price: 5, cadence: 7 * 86_400, minPer: 160, terms: 'Daily rider fees pooled by the fleet manager; weekly payout to the vault.' },
  { name: 'Fresh-market cold storage', summary: 'Shared cold storage for fresh produce, billed per crate per day to 40 traders.', category: 2, shares: 500, forSale: 350, price: 40, cadence: 30 * 86_400, minPer: 500, terms: 'Monthly payout. Compressor and generator maintained by the operator.' },
  { name: 'Podcast network catalogue', summary: 'Ad and sponsorship income from a 4-show audio catalogue with 80k monthly listens.', category: 6, shares: 800, forSale: 400, price: 18, cadence: 14 * 86_400, minPer: 150, terms: 'Fortnightly statements from the ad platform are attached on-chain.' },
];

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const;
  readonly chainLabel = 'Simulated network';
  readonly deployed = true;
  readonly deployment: Deployment = { network: 'simulated', chainId: 0, portion: '0x0000000000000000000000000000000000000000', pusdAssetId: 4217, deedsCollection: 0, treasury: 'demo', deployer: 'demo' };

  private revision = 0;
  private offset = 0; // simulated seconds added to the clock
  private block = 70_000;
  private ls: SimListing[] = [];
  private events: ActivityRow[] = [];
  private evId = 1;
  private accounts = new Map<string, { pot: bigint; pusd: bigint; shares: Map<number, bigint> }>();
  private docs = new Map<string, { data: string; json?: any }>();
  private listeners = new Set<() => void>();
  private revenueLog = new Map<number, { ts: number; amount: bigint; kind: 'revenue' | 'slash' }[]>();
  private pools = new Map<number, { s: bigint; p: bigint }>();

  constructor() {
    const t = this.now();
    SEEDS.forEach((s, i) => {
      const cover = 'demo:' + i;
      this.docs.set(cover, { data: 'data:image/svg+xml;utf8,' + encodeURIComponent(generateCover(s.name, s.category)) });
      const doc = 'demodoc:' + i;
      this.docs.set(doc, { data: '', json: { v: 1, name: s.name, summary: s.summary, category: s.category, terms: s.terms, createdAt: new Date(Date.now() - (i + 2) * 86_400_000).toISOString() } });
      const price = U(s.price);
      const sold = Math.floor((s.forSale * (0.35 + i * 0.15)) % s.forSale);
      const l: SimListing = {
        id: i, operator: '0x' + (i + 1).toString(16).padStart(40, 'a'), operatorAddr: 'demo-op-' + i, payToken: assetErc20Address(4217),
        assetId: 200_000 + i, nftCollection: 0, nftItem: 1000 + i, category: s.category, strikes: 0, totalShares: s.shares, cadence: s.cadence,
        createdAt: t - (i + 2) * 86_400, lastDepositAt: t - (i === 3 ? s.cadence * 1.8 : 2) * (i === 3 ? 1 : 86_400), closedAt: 0, saleOpen: true,
        docHash: doc, coverHash: cover, minPerPeriod: U(s.minPer), name: s.name, summary: s.summary, shareToken: assetErc20Address(200_000 + i),
        vault: { totalStaked: BigInt(sold), accPerShare: 0n, totalRevenue: 0n, deposits: 0, bond: (BigInt(s.forSale) * price * 500n) / 10_000n, forSale: s.forSale - sold, sold, salePrice: price },
        stakes: new Map(),
      };
      // a believable history: a few deposits already made
      const per = U(s.minPer) * 11n / 10n;
      const n = i === 3 ? 2 : 4;
      for (let k = 0; k < n; k++) {
        const net = (per * 9950n) / 10_000n;
        if (l.vault.totalStaked > 0n) l.vault.accPerShare += (net * PRECISION) / l.vault.totalStaked;
        l.vault.totalRevenue += net;
        l.vault.deposits++;
        const ts = t - (n - k + (i === 3 ? 1 : 0)) * s.cadence + 3600;
        (this.revenueLog.get(i) ?? this.revenueLog.set(i, []).get(i)!).push({ ts, amount: net, kind: 'revenue' });
      }
      this.ls.push(l);
      if (i < 2) this.pools.set(i, { s: BigInt(Math.round(s.shares * 0.05)), p: BigInt(Math.round(s.shares * 0.05)) * price * 105n / 100n });
      this.pushEvent('Listed', i, l.operator, { name: s.name, totalShares: s.shares }, t - (i + 2) * 86_400);
    });
  }

  // ───────── plumbing ─────────
  subscribe(fn: () => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit() { this.revision++; this.listeners.forEach((f) => f()); }
  now() { return Math.floor(Date.now() / 1000) + this.offset; }
  async head() { return this.block; }
  /** Demo-only: jump the clock forward to show late payments and slashing. */
  advance(seconds: number) { this.offset += seconds; this.block += Math.floor(seconds / 6); this.emit(); }
  private pushEvent(kind: string, listingId: number | null, actor: string | null, data: Record<string, any>, ts = this.now()) {
    this.events.unshift({ id: this.evId++, block: this.block, ts, kind, listingId, actor: actor?.toLowerCase() ?? null, data });
  }
  private acct(addr: string) {
    let a = this.accounts.get(addr);
    if (!a) { a = { pot: 20n * 10n ** 14n, pusd: U(2_000), shares: new Map() }; this.accounts.set(addr, a); }
    return a;
  }
  private health(l: SimListing): ListingView['health'] {
    if (l.closedAt) return 'WoundDown';
    const overdue = this.now() - l.lastDepositAt;
    return overdue <= l.cadence ? 'Healthy' : overdue <= 2 * l.cadence ? 'Late' : 'Defaulted';
  }
  private view(l: SimListing): ListingView { const { stakes: _s, operatorAddr: _o, ...rest } = l; return { ...rest, health: this.health(l) as any }; }
  private stakeOf(l: SimListing, who: string) { let s = l.stakes.get(who); if (!s) { s = { amount: 0n, debt: 0n, owed: 0n }; l.stakes.set(who, s); } return s; }
  private harvest(l: SimListing, s: SimStake) { if (s.amount === 0n) return; const acc = (s.amount * l.vault.accPerShare) / PRECISION; s.owed += acc - s.debt; s.debt = acc; }
  private credit(l: SimListing, who: string, n: bigint) { const s = this.stakeOf(l, who); this.harvest(l, s); s.amount += n; l.vault.totalStaked += n; s.debt = (s.amount * l.vault.accPerShare) / PRECISION; }
  private pendingOf(l: SimListing, who: string) { const s = l.stakes.get(who); if (!s) return 0n; return s.owed + (s.amount * l.vault.accPerShare) / PRECISION - s.debt; }

  // ───────── reads ─────────
  async listings() { return this.ls.map((l) => this.view(l)); }
  async listing(id: number) { const l = this.ls[id]; if (!l) throw new UserError('Unknown listing'); return this.view(l); }
  async positions(a: string): Promise<PositionView[]> {
    return this.ls.flatMap((l) => { const s = l.stakes.get(a); const p = this.pendingOf(l, a); return s && (s.amount > 0n || p > 0n) ? [{ id: l.id, staked: Number(s.amount), pending: p }] : []; });
  }
  async balances(a: string): Promise<Balances> { const x = this.acct(a); return { pot: x.pot, pusd: x.pusd }; }
  async shareBalance(assetId: number, a: string) { const l = this.ls.find((x) => x.assetId === assetId); return l ? (this.acct(a).shares.get(l.id) ?? 0n) : 0n; }
  async rules() { return RULES; }
  async pool(l: ListingView): Promise<PoolView | null> { const p = this.pools.get(l.id); return p && p.s > 0n ? { shares: p.s, pusd: p.p, price: p.p / p.s } : null; }
  async quote(l: ListingView, side: 'buy' | 'sell', amountIn: bigint) {
    const p = this.pools.get(l.id); if (!p) return null;
    const [rin, rout] = side === 'buy' ? [p.p, p.s] : [p.s, p.p];
    const inFee = amountIn * 997n; return (inFee * rout) / (rin * 1000n + inFee);
  }
  docUrl(hash: string) { return this.docs.get(hash)?.data ?? ''; }
  async docMeta(hash: string): Promise<DocMeta | null> { return this.docs.has(hash) ? { hash, block: this.block - 900, index: 1, size: 1400, expiresAtBlock: this.block + 99_000, blocksLeft: 99_000, daysLeft: 6.9 } : null; }
  async docJson(hash: string) { return this.docs.get(hash)?.json ?? null; }
  async proof(id: number): Promise<ProofView | null> { const l = this.ls[id]; return l ? { deedLocked: true, fractionalized: true, fractions: String(l.totalShares), assetMatches: true, supplyMatches: true, supply: String(l.totalShares), adminIsPallet: true, verified: true, notes: ['Simulated: on the live network this is read from the Nfts, NftFractionalization and Assets pallets.'] } : null; }
  async activity(q: { listing?: number; actor?: string; limit?: number }) { return this.events.filter((e) => (q.listing === undefined || e.listingId === q.listing) && (!q.actor || e.actor === q.actor)).slice(0, q.limit ?? 30); }
  async revenue(id: number) { return this.revenueLog.get(id) ?? []; }
  async drip(address: string): Promise<DripResult> {
    const a = this.acct(address); a.pot += 3n * 10n ** 14n; a.pusd += U(500); this.emit();
    return { ss58: address, h160: address, viaEvm: false, tx: '0xsimulated', pot: String(3n * 10n ** 14n), pusd: String(U(500)) };
  }

  private validate(intent: Intent, who: Passport) {
    const positiveShares = (n: number) => { if (!Number.isSafeInteger(n) || n <= 0) throw new UserError('Enter a positive whole number of shares.'); };
    const positiveMoney = (n: bigint) => { if (n <= 0n) throw new UserError('Enter an amount greater than zero.'); };
    const acct = this.acct(who.address);
    const funds = (n: bigint) => { positiveMoney(n); if (acct.pusd < n) throw new UserError('You do not have enough pUSD. Get some from the faucet.', 'faucet'); };
    if (intent.kind === 'tokenize') {
      const f = intent.form;
      positiveShares(f.totalShares);
      if (!Number.isSafeInteger(f.sharesForSale) || f.sharesForSale < 0 || f.sharesForSale > f.totalShares) throw new UserError('Offered shares must be between zero and the total share count.');
      const utf8 = new TextEncoder();
      if (!f.name.trim() || utf8.encode(f.name).length > 64 || utf8.encode(f.summary).length > 280) throw new UserError('Enter a name up to 64 bytes and a summary up to 280 bytes.');
      if (!Number.isSafeInteger(f.cadenceSeconds) || f.cadenceSeconds < RULES.minCadence) throw new UserError('The payment period must be at least 60 seconds.');
      let price: bigint, minimum: bigint, bond: bigint;
      try { price = parseUnits(f.pricePusd, 6); minimum = parseUnits(f.minPerPeriodPusd, 6); bond = parseUnits(f.bondPusd, 6); }
      catch { throw new UserError('Use valid amounts with at most six decimal places.'); }
      positiveMoney(price); positiveMoney(minimum);
      if (bond < 0n || bond < BigInt(f.sharesForSale) * price * 500n / 10000n) throw new UserError('The bond must cover at least 5% of the offered raise.');
      if (bond > 0n) funds(bond);
      return;
    }
    if (intent.kind === 'claim') {
      if (intent.ids.some(id => !this.ls[id])) throw new UserError('Unknown listing');
      if (!intent.ids.some(id => this.pendingOf(this.ls[id], who.address) > 0n)) throw new UserError('Nothing to claim yet.');
      return;
    }
    const l = this.ls[intent.id];
    if (!l) throw new UserError('Unknown listing');
    const operatorOnly = () => { if (who.address !== l.operatorAddr) throw new UserError('Only this listing’s operator can do that.'); };
    const active = () => { if (l.closedAt) throw new UserError('This listing has been wound down.'); };
    switch (intent.kind) {
      case 'buy':
        positiveShares(intent.shares);
        if (!l.saleOpen || intent.shares > l.vault.forSale) throw new UserError('That many shares are no longer available.');
        funds(BigInt(intent.shares) * l.vault.salePrice); break;
      case 'deposit':
        funds(intent.amount);
        if (l.vault.totalStaked === 0n) throw new UserError('There are no staked shares to receive this payment.');
        break;
      case 'topUp': operatorOnly(); active(); funds(intent.amount); break;
      case 'stake':
        active(); positiveShares(intent.amount);
        if ((acct.shares.get(l.id) ?? 0n) < BigInt(intent.amount)) throw new UserError('You hold fewer unstaked shares than that.');
        break;
      case 'unstake':
        positiveShares(intent.amount);
        if ((l.stakes.get(who.address)?.amount ?? 0n) < BigInt(intent.amount)) throw new UserError('You staked fewer shares than that.');
        break;
      case 'slash':
        if (this.health(l) !== 'Defaulted' || l.vault.bond === 0n) throw new UserError('This bond cannot be slashed right now.');
        break;
      case 'operator':
        operatorOnly();
        if (intent.fn === 'windDown') {
          active();
          if (l.vault.totalStaked > 0n) throw new UserError('This listing cannot close while earning shares remain staked. Closing does not repay investors.');
          if (this.health(l) === 'Defaulted' && l.vault.bond > 0n) throw new UserError('The overdue bond must be slashed before the listing can close.');
        }
        if (intent.fn === 'withdrawBond') {
          if (!l.closedAt || this.now() < l.closedAt + 2 * l.cadence) throw new UserError('The bond is still in its two-period closing wait.');
          if (l.vault.bond === 0n) throw new UserError('There is no bond left to withdraw.');
        }
        break;
      case 'dexBuy': active(); funds(intent.pusdIn); if (!this.pools.has(l.id)) throw new UserError('No trading pool exists.'); break;
      case 'dexSell': positiveShares(intent.sharesIn); if ((acct.shares.get(l.id) ?? 0n) < BigInt(intent.sharesIn)) throw new UserError('Unstake enough shares before selling.'); break;
      case 'dexSeed': positiveShares(intent.shares); funds(intent.pusd); if ((acct.shares.get(l.id) ?? 0n) < BigInt(intent.shares)) throw new UserError('You do not have enough unstaked shares.'); break;
    }
  }

  // ───────── actions ─────────
  async prepare(intent: Intent, who: Passport): Promise<Prepared> {
    this.validate(intent, who);
    const me = who.address;
    const acct = this.acct(me);
    const lane = (key: string, lane: PlanStep['lane'], pallet: string, method: string, title: string, detail: string): PlanStep => ({ key, lane, pallet, method, title, detail });
    const done = (p: Omit<Prepared, 'run'>, fn: () => Partial<ActionResult> | void): Prepared => {
      const expectedRevision = this.revision;
      let submitted = false;
      return {
        ...p,
        run: async (onStage: (s: StageName, d?: string) => void) => {
          if (submitted) return { ok: false, error: 'This request has already been submitted. Prepare a new one.' };
          submitted = true;
          onStage('signing'); await sleep(350); onStage('broadcast'); await sleep(450);
          try {
            if (this.revision !== expectedRevision) throw new UserError('The simulation changed while you were confirming. Review the latest amounts and try again.');
            this.validate(intent, who);
            const extra = fn() ?? {};
            this.block++; this.emit(); onStage('inBlock'); await sleep(250);
            return { ok: true, txHash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0'), blockNumber: this.block, ...extra };
          } catch (e) { return { ok: false, error: (e as Error).message }; }
        },
      };
    };

    switch (intent.kind) {
      case 'buy': {
        const l = this.ls[intent.id]; if (!l) throw new UserError('Unknown listing');
        const cost = BigInt(intent.shares) * l.vault.salePrice;
        if (!l.saleOpen) throw new UserError('This sale is closed.');
        if (intent.shares < 1 || BigInt(intent.shares) > BigInt(l.vault.forSale)) throw new UserError(`Only ${l.vault.forSale} shares are available.`);
        if (acct.pusd < cost) throw new UserError('You do not have enough pUSD for this. Get some from the faucet.', 'faucet');
        return done({ title: `Buy ${intent.shares} shares of ${l.name}`, cost: 'Your pUSD goes to the operator (minus a 1% fee). Nothing is locked.', steps: [lane('ap', 'native', 'Assets', 'approveTransfer', 'Approve payment', 'Lets the registry pull exactly this amount of pUSD.'), lane('buy', 'evm', 'Revive', 'call', `Buy ${intent.shares} shares`, 'Portion.buy(): pays the operator, takes the 1% fee, and starts your shares earning immediately.')] }, () => {
          const fee = (cost * 100n) / 10_000n; acct.pusd -= cost; l.vault.forSale -= intent.shares; l.vault.sold += intent.shares;
          if (l.vault.forSale === 0) l.saleOpen = false;
          this.credit(l, me, BigInt(intent.shares));
          this.acct(l.operatorAddr).pusd += cost - fee;
          this.acct(this.deployment.treasury).pusd += fee;
          this.pushEvent('Bought', l.id, who.h160, { shares: intent.shares, cost: cost.toString() });
        });
      }
      case 'claim': {
        const ids = intent.ids.filter((id) => this.pendingOf(this.ls[id], me) > 0n);
        if (!ids.length) throw new UserError('Nothing to claim yet.');
        return done({ title: 'Claim revenue', steps: ids.map((id) => lane('c' + id, 'evm', 'Revive', 'call', `Claim listing #${id}`, 'Portion.claim() pays pending revenue in pUSD.')) }, () => {
          for (const id of ids) { const l = this.ls[id]; const s = this.stakeOf(l, me); this.harvest(l, s); acct.pusd += s.owed; this.pushEvent('Claimed', id, who.h160, { amount: s.owed.toString() }); s.owed = 0n; }
        });
      }
      case 'deposit': {
        const l = this.ls[intent.id]; if (acct.pusd < intent.amount) throw new UserError('You do not have enough pUSD for this. Get some from the faucet.', 'faucet');
        if (l.vault.totalStaked === 0n) throw new UserError('Nobody has bought shares yet, so there is no one to pay.');
        return done({ title: `Deposit revenue into ${l.name}`, steps: [lane('ap', 'native', 'Assets', 'approveTransfer', 'Approve payment', 'Lets the registry pull this deposit.'), lane('dep', 'evm', 'Revive', 'call', 'Deposit revenue', 'Splits the payment across staked shares. Only a qualifying operator payment resets the clock.')] }, () => {
          const fee = (intent.amount * 50n) / 10_000n; const net = intent.amount - fee; acct.pusd -= intent.amount;
          l.vault.accPerShare += (net * PRECISION) / l.vault.totalStaked; l.vault.totalRevenue += net; l.vault.deposits++;
          this.acct(this.deployment.treasury).pusd += fee;
          const qualifying = me === l.operatorAddr && intent.amount >= l.minPerPeriod;
          if (qualifying) l.lastDepositAt = this.now();
          (this.revenueLog.get(l.id) ?? this.revenueLog.set(l.id, []).get(l.id)!).push({ ts: this.now(), amount: net, kind: 'revenue' });
          this.pushEvent('RevenueDeposited', l.id, who.h160, { net: net.toString(), qualifying });
        });
      }
      case 'slash': {
        const l = this.ls[intent.id]; if (this.health(l) !== 'Defaulted') throw new UserError('This operator is not slashable yet.'); if (l.vault.bond === 0n) throw new UserError('The bond is already slashed.');
        return done({ title: 'Slash the operator bond', cost: 'You keep a 1% tip. The rest goes to share-holders.', steps: [lane('slash', 'evm', 'Revive', 'call', 'Slash the operator bond', 'Distributes the bond to share-holders; the caller keeps a 1% tip.')] }, () => {
          const b = l.vault.bond; l.vault.bond = 0n; l.strikes++; const tip = (b * 100n) / 10_000n; acct.pusd += tip; const toHolders = l.vault.totalStaked > 0n ? b - tip : 0n;
          if (l.vault.totalStaked === 0n) this.acct(this.deployment.treasury).pusd += b - tip;
          if (l.vault.totalStaked > 0n) { l.vault.accPerShare += (toHolders * PRECISION) / l.vault.totalStaked; l.vault.totalRevenue += toHolders; }
          (this.revenueLog.get(l.id) ?? this.revenueLog.set(l.id, []).get(l.id)!).push({ ts: this.now(), amount: toHolders, kind: 'slash' });
          this.pushEvent('Slashed', l.id, who.h160, { toHolders: toHolders.toString(), tip: tip.toString() });
        });
      }
      case 'topUp': {
        const l = this.ls[intent.id];
        return done({ title: 'Top up the bond', steps: [lane('bond', 'evm', 'Revive', 'call', 'Top up the bond', 'Re-arms accountability after a slash.')] }, () => { acct.pusd -= intent.amount; l.vault.bond += intent.amount; this.pushEvent('BondToppedUp', l.id, who.h160, { amount: intent.amount.toString(), newBond: l.vault.bond.toString() }); });
      }
      case 'stake': case 'unstake': {
        const l = this.ls[intent.id];
        return done({ title: intent.kind === 'stake' ? 'Stake shares to earn' : 'Unstake shares', steps: [lane('s', 'evm', 'Revive', 'call', intent.kind, 'Portion.' + intent.kind + '()')] }, () => {
          const n = BigInt(intent.amount);
          if (intent.kind === 'stake') { const have = acct.shares.get(l.id) ?? 0n; if (have < n) throw new Error('You hold fewer shares than that.'); acct.shares.set(l.id, have - n); this.credit(l, me, n); }
          else { const s = this.stakeOf(l, me); if (s.amount < n) throw new Error('You staked fewer shares than that.'); this.harvest(l, s); s.amount -= n; l.vault.totalStaked -= n; s.debt = (s.amount * l.vault.accPerShare) / PRECISION; acct.shares.set(l.id, (acct.shares.get(l.id) ?? 0n) + n); }
          this.pushEvent(intent.kind === 'stake' ? 'Staked' : 'Unstaked', l.id, who.h160, { amount: n.toString() });
        });
      }
      case 'operator': {
        const l = this.ls[intent.id];
        return done({ title: intent.fn, steps: [lane('o', 'evm', 'Revive', 'call', intent.fn, 'Portion.' + intent.fn + '()')] }, () => {
          if (intent.fn === 'windDown') { acct.shares.set(l.id, (acct.shares.get(l.id) ?? 0n) + BigInt(l.vault.forSale)); l.closedAt = this.now(); l.saleOpen = false; l.vault.forSale = 0; }
          if (intent.fn === 'closeSale') { acct.shares.set(l.id, (acct.shares.get(l.id) ?? 0n) + BigInt(l.vault.forSale)); l.saleOpen = false; l.vault.forSale = 0; }
          if (intent.fn === 'withdrawBond') { if (!l.closedAt || this.now() < l.closedAt + 2 * l.cadence) throw new Error('StillWindingDown'); acct.pusd += l.vault.bond; l.vault.bond = 0n; }
          this.pushEvent(intent.fn === 'windDown' ? 'WoundDown' : intent.fn === 'closeSale' ? 'SaleClosed' : 'BondWithdrawn', l.id, who.h160, {});
        });
      }
      case 'dexSeed': {
        const l = this.ls[intent.id]; const have = acct.shares.get(l.id) ?? 0n;
        if (have < BigInt(intent.shares)) throw new UserError('You hold fewer unstaked shares than that. Only your own spare shares can seed the pool.');
        if (acct.pusd < intent.pusd) throw new UserError('You do not have enough pUSD. Get some from the faucet.', 'faucet');
        return done({ title: `Open a market for ${l.name}`, cost: 'You can withdraw the liquidity later.', steps: [lane('pool', 'native', 'AssetConversion', 'createPool', 'Create the share / pUSD pool', 'A native Uniswap-style pool.'), lane('liq', 'native', 'AssetConversion', 'addLiquidity', 'Add liquidity', 'Sets the opening price.')] }, () => {
          acct.shares.set(l.id, have - BigInt(intent.shares)); acct.pusd -= intent.pusd; this.pools.set(l.id, { s: BigInt(intent.shares), p: intent.pusd });
        });
      }
      case 'dexBuy': {
        const l = this.ls[intent.id]; if (acct.pusd < intent.pusdIn) throw new UserError('You do not have enough pUSD. Get some from the faucet.', 'faucet');
        const out = await this.quote(this.view(l), 'buy', intent.pusdIn); if (!out || out < 1n) throw new UserError('That amount is too small to buy a whole share.');
        return done({ title: `Buy ${l.name} on the market`, cost: 'Includes the pool’s 0.3% fee. No Portion fee applies.', steps: [lane('swap', 'native', 'AssetConversion', 'swapExactTokensForTokens', `Swap for about ${out} shares`, 'Trades against the pool.'), lane('stake', 'evm', 'Revive', 'call', 'Stake them to earn revenue', 'Portion.stake()')] }, () => {
          const p = this.pools.get(l.id)!; p.p += intent.pusdIn; p.s -= out; acct.pusd -= intent.pusdIn; this.credit(l, me, out);
        });
      }
      case 'dexSell': {
        const l = this.ls[intent.id]; const have = acct.shares.get(l.id) ?? 0n;
        if (have < BigInt(intent.sharesIn)) throw new UserError('Those shares are inside the vault. Take them out first, then sell.');
        const out = await this.quote(this.view(l), 'sell', BigInt(intent.sharesIn)); if (!out) throw new UserError('There is no market for this listing yet.');
        return done({ title: `Sell ${intent.sharesIn} shares`, steps: [lane('swap', 'native', 'AssetConversion', 'swapExactTokensForTokens', 'Swap shares for pUSD', 'Trades against the pool.')] }, () => {
          const p = this.pools.get(l.id)!; p.s += BigInt(intent.sharesIn); p.p -= out; acct.shares.set(l.id, have - BigInt(intent.sharesIn)); acct.pusd += out;
        });
      }
      case 'tokenize': return this.tokenize(intent.form, who, done);
    }
  }

  private tokenize(f: TokenizeForm, who: Passport, done: (p: Omit<Prepared, 'run'>, fn: () => Partial<ActionResult> | void) => Prepared): Prepared {
    const acct = this.acct(who.address);
    const price = parseUnits(f.pricePusd, 6); const bond = parseUnits(f.bondPusd, 6);
    if (bond < (BigInt(f.sharesForSale) * price * 500n) / 10_000n) throw new UserError('The bond must be at least 5% of the raise.');
    if (acct.pusd < bond) throw new UserError('You do not have enough pUSD for the bond. Get some from the faucet.', 'faucet');
    const lane = (key: string, l: PlanStep['lane'], pallet: string, method: string, title: string, detail: string): PlanStep => ({ key, lane: l, pallet, method, title, detail });
    return done({
      title: `Tokenize ${f.name}`,
      cost: `You lock a ${f.bondPusd} pUSD bond and about 3 tPOT of refundable deposits.`,
      steps: [
        lane('doc', 'storage', 'TransactionStorage', 'store', 'Store the terms on-chain', 'Content-addressed, retained by the chain for about 7 days and renewed by a keeper.'),
        lane('cover', 'storage', 'TransactionStorage', 'store', 'Store the photo on-chain', 'Compressed to fit the 32 KB per-transaction limit.'),
        lane('mint', 'native', 'Nfts', 'mint', 'Mint the deed', 'A native NFT in the shared Portion Deeds collection represents the asset itself.'),
        lane('meta', 'native', 'Nfts', 'setAttribute', 'Pin the terms hash to the deed', 'The NFT carries the hash of the terms stored on-chain.'),
        lane('frac', 'native', 'NftFractionalization', 'fractionalize', `Split into ${f.totalShares.toLocaleString()} shares`, 'The pallet disables transfers of the deed and mints a fixed supply of native shares that only it can administer.'),
        lane('ap1', 'native', 'Assets', 'approveTransfer', 'Allow the registry to escrow shares for sale', 'Native approval, seen by Solidity as an ERC-20 allowance.'),
        lane('ap2', 'native', 'Assets', 'approveTransfer', 'Allow the registry to hold your bond', 'The bond is slashed to holders if revenue stops.'),
        lane('evm', 'evm', 'Revive', 'call', 'Register the listing in Solidity', 'Portion.createListing(...) checks supply, pulls shares and bond, opens the sale.'),
      ],
    }, () => {
      const id = this.ls.length; const t = this.now();
      const cover = 'demo-cover:' + id; const doc = 'demo-doc:' + id;
      const svg = f.image ? null : generateCover(f.name, f.category);
      this.docs.set(cover, { data: f.image ? URL.createObjectURL(new Blob([f.image.bytes as BlobPart], { type: f.image.mime })) : 'data:image/svg+xml;utf8,' + encodeURIComponent(svg!) });
      this.docs.set(doc, { data: '', json: { v: 1, name: f.name, summary: f.summary, category: f.category, terms: f.terms, createdAt: new Date().toISOString() } });
      acct.pusd -= bond;
      this.ls.push({
        id, operator: who.h160, operatorAddr: who.address, payToken: assetErc20Address(4217), assetId: 200_000 + id, nftCollection: 0, nftItem: 1000 + id, category: f.category, strikes: 0, totalShares: f.totalShares,
        cadence: f.cadenceSeconds, createdAt: t, lastDepositAt: t, closedAt: 0, saleOpen: f.sharesForSale > 0, docHash: doc, coverHash: cover, minPerPeriod: parseUnits(f.minPerPeriodPusd, 6), name: f.name, summary: f.summary,
        shareToken: assetErc20Address(200_000 + id), stakes: new Map(),
        vault: { totalStaked: 0n, accPerShare: 0n, totalRevenue: 0n, deposits: 0, bond, forSale: f.sharesForSale, sold: 0, salePrice: price },
      });
      acct.shares.set(id, BigInt(f.totalShares - f.sharesForSale));
      this.pushEvent('Listed', id, who.h160, { name: f.name, totalShares: f.totalShares });
      return { listingId: id };
    });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export { HEALTH };
