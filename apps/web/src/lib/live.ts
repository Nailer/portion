import type { ApiPromise } from '@polkadot/api';
import {
  createPoolAndSeed, quoteExactIn, reserves, swapExactIn, withId, FALLBACK_LIMITS,
  PortionClient, assetBalance, contentHash, generateCover, nativeFree, parseUnits, storeTx, submit, MAX_DOC_BYTES,
  TESTNET, type Deployment, type ListingView, type Passport, type Plan, type PlanStep, type TxStage,
} from '@portion/sdk';
import {
  api as http, API_BASE, UserError,
  type ActionResult, type ActivityRow, type Backend, type Balances, type DocMeta, type DripResult, type Intent,
  type PoolView, type Prepared, type ProofView, type Rules, type StageName, type TokenizeForm,
} from './backend';

const usdLabel = (v: bigint) => `${(Number(v) / 1e6).toFixed(2)} pUSD`;
const stageMap: Record<TxStage, StageName> = { signing: 'signing', broadcast: 'broadcast', inBlock: 'inBlock', finalized: 'done', failed: 'failed' };

export class LiveBackend implements Backend {
  readonly mode = 'live' as const;
  readonly chainLabel = TESTNET.name;
  readonly client?: PortionClient;
  private rulesCache?: Rules;

  constructor(
    readonly chain: ApiPromise,
    readonly deployment?: Deployment,
  ) {
    if (deployment) this.client = new PortionClient(chain, deployment);
  }

  get deployed() {
    return !!this.client;
  }

  private need(): PortionClient {
    if (!this.client) throw new UserError('Portion is not deployed on this network yet.');
    return this.client;
  }

  now() {
    return Math.floor(Date.now() / 1000);
  }
  async head() {
    return (await this.chain.rpc.chain.getHeader()).number.toNumber();
  }

  listings() {
    return this.client ? this.client.listings() : Promise.resolve([]);
  }
  listing(id: number) {
    return this.need().listing(id);
  }
  positions(a: string) {
    return this.client ? this.client.positions(a) : Promise.resolve([]);
  }
  async balances(address: string): Promise<Balances> {
    const pot = await nativeFree(this.chain, address);
    const pusd = this.deployment ? await assetBalance(this.chain, this.deployment.pusdAssetId, address) : 0n;
    return { pot, pusd };
  }
  shareBalance(assetId: number, address: string) {
    return assetBalance(this.chain, assetId, address);
  }
  async rules() {
    return (this.rulesCache ??= await this.need().rules());
  }

  async pool(l: ListingView): Promise<PoolView | null> {
    const r = await reserves(this.chain, withId(l.assetId), withId(this.need().deployment.pusdAssetId));
    if (!r || r[0] === 0n) return null;
    return { shares: r[0], pusd: r[1], price: r[1] / r[0] };
  }
  async quote(l: ListingView, side: 'buy' | 'sell', amountIn: bigint) {
    const pusd = withId(this.need().deployment.pusdAssetId);
    const share = withId(l.assetId);
    return quoteExactIn(this.chain, side === 'buy' ? pusd : share, side === 'buy' ? share : pusd, amountIn);
  }

  docUrl(hash: string) {
    return `${API_BASE}/api/doc/${hash}`;
  }
  async docMeta(hash: string): Promise<DocMeta | null> {
    try {
      return await http<DocMeta>(`/api/doc/${hash}/meta`);
    } catch {
      return null;
    }
  }
  async docJson(hash: string) {
    try {
      const r = await fetch(this.docUrl(hash));
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }
  async proof(id: number): Promise<ProofView | null> {
    try {
      return await http<ProofView>(`/api/listings/${id}/proof`);
    } catch {
      return null;
    }
  }
  async activity(q: { listing?: number; actor?: string; limit?: number }): Promise<ActivityRow[]> {
    const p = new URLSearchParams();
    if (q.listing !== undefined) p.set('listing', String(q.listing));
    if (q.actor) p.set('actor', q.actor);
    if (q.limit) p.set('limit', String(q.limit));
    try {
      return await http<ActivityRow[]>(`/api/activity?${p}`);
    } catch {
      return [];
    }
  }
  async revenue(id: number) {
    try {
      const rows = await http<{ ts: number; amount: string; kind: 'revenue' | 'slash' }[]>(`/api/listings/${id}/revenue`);
      return rows.map((r) => ({ ...r, amount: BigInt(r.amount) }));
    } catch {
      return [];
    }
  }
  drip(address: string) {
    return http<DripResult>('/api/drip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) });
  }

  // ───────────── actions ─────────────

  private async ensureGas(who: Passport, min = 1n * 10n ** 14n) {
    const free = await nativeFree(this.chain, who.address);
    if (free < min) throw new UserError('Your Passport needs a little tPOT for fees and refundable storage deposits.', 'faucet');
  }

  private async ensurePusd(who: Passport, need: bigint) {
    const have = await assetBalance(this.chain, this.need().deployment.pusdAssetId, who.address);
    if (have < need) throw new UserError('You do not have enough pUSD for this. Get some from the faucet.', 'faucet');
  }

  private wrap(title: string, plan: Plan, who: Passport, cost?: string): Prepared {
    return {
      title,
      steps: plan.steps,
      cost,
      run: async (onStage) => {
        try {
          const out = await submit(this.chain, plan.tx, who.pair, (s, d) => onStage(stageMap[s], d));
          return { ok: out.ok, txHash: out.txHash, blockNumber: out.blockNumber, error: out.error };
        } catch (e) {
          return { ok: false, error: (e as Error).message };
        }
      },
    };
  }

  async prepare(intent: Intent, who: Passport): Promise<Prepared> {
    const c = this.need();
    await this.ensureGas(who);
    switch (intent.kind) {
      case 'buy': {
        const l = await c.listing(intent.id);
        if (!l.saleOpen) throw new UserError('This sale is closed.');
        if (intent.shares < 1 || intent.shares > l.vault.forSale) throw new UserError(`Only ${l.vault.forSale} shares are available.`);
        const cost = BigInt(intent.shares) * l.vault.salePrice;
        await this.ensurePusd(who, cost);
        return this.wrap(`Buy ${intent.shares} share${intent.shares === 1 ? '' : 's'} of ${l.name}`, c.planBuy(l, intent.shares), who, 'Your pUSD goes to the operator (minus a 1% fee). Nothing is locked.');
      }
      case 'claim': {
        if (!intent.ids.length) throw new UserError('Nothing to claim yet.');
        return this.wrap(intent.ids.length === 1 ? 'Claim revenue' : `Claim revenue from ${intent.ids.length} listings`, c.planClaim(intent.ids), who);
      }
      case 'deposit': {
        const l = await c.listing(intent.id);
        await this.ensurePusd(who, intent.amount);
        return this.wrap(`Deposit revenue into ${l.name}`, c.planDeposit(l, intent.amount), who, 'Every staked share receives its portion straight away.');
      }
      case 'stake': {
        const l = await c.listing(intent.id);
        const bal = await c.shareBalance(l.assetId, who.address);
        if (bal < BigInt(intent.amount)) throw new UserError('You hold fewer shares than that in your Passport.');
        return this.wrap('Stake shares to earn', c.planStake(l, intent.amount), who);
      }
      case 'unstake': {
        const l = await c.listing(intent.id);
        return this.wrap('Unstake shares', c.planUnstake(l, intent.amount), who);
      }
      case 'slash':
        return this.wrap('Slash the operator bond', c.planSlash(intent.id), who, 'You keep a 1% tip. The rest goes to share-holders.');
      case 'topUp': {
        const l = await c.listing(intent.id);
        await this.ensurePusd(who, intent.amount);
        return this.wrap('Top up the bond', c.planTopUpBond(l, intent.amount), who);
      }
      case 'operator':
        return this.wrap({ closeSale: 'Close the sale', windDown: 'Wind the listing down', withdrawBond: 'Withdraw the bond' }[intent.fn], c.planOperator(intent.fn, intent.id), who);
      case 'dexSeed': {
        const l = await c.listing(intent.id);
        const have = await c.shareBalance(l.assetId, who.address);
        if (have < BigInt(intent.shares)) throw new UserError('You hold fewer unstaked shares than that. Only your own spare shares can seed the pool.');
        await this.ensurePusd(who, intent.pusd);
        await this.ensureGas(who, 3n * 10n ** 14n);
        const tx = createPoolAndSeed(this.chain, withId(l.assetId), withId(this.need().deployment.pusdAssetId), BigInt(intent.shares), intent.pusd, who.address);
        return this.wrap(`Open a market for ${l.name}`, { tx, steps: [
          { key: 'pool', lane: 'native', pallet: 'AssetConversion', method: 'createPool', title: 'Create the share / pUSD pool', detail: 'A native Uniswap-style pool. Setup costs 1 tPOT.' },
          { key: 'liq', lane: 'native', pallet: 'AssetConversion', method: 'addLiquidity', title: `Add ${intent.shares} shares and ${usdLabel(intent.pusd)} of liquidity`, detail: 'Sets the opening price and lets anyone trade shares with no order book.' },
        ] }, who, 'You can withdraw the liquidity later. LP tokens go to your Passport.');
      }
      case 'dexBuy': {
        const l = await c.listing(intent.id);
        await this.ensurePusd(who, intent.pusdIn);
        const q = await this.quote(l, 'buy', intent.pusdIn);
        if (!q) throw new UserError('There is no market for this listing yet.');
        const minOut = (q * 97n) / 100n;
        if (minOut < 1n) throw new UserError('That amount is too small to buy a whole share.');
        const calls = [
          swapExactIn(this.chain, [withId(this.need().deployment.pusdAssetId), withId(l.assetId)], intent.pusdIn, minOut, who.address),
          this.chain.tx.assets.approveTransfer(l.assetId, c.contractAccount, minOut),
          this.chain.tx.revive.call(this.need().deployment.portion, 0n, FALLBACK_LIMITS.weight, FALLBACK_LIMITS.deposit, c.contract.encode('stake', [l.id, minOut])),
        ];
        return this.wrap(`Buy ${l.name} on the market`, { tx: this.chain.tx.utility.batchAll(calls), steps: [
          { key: 'swap', lane: 'native', pallet: 'AssetConversion', method: 'swapExactTokensForTokens', title: `Swap ${usdLabel(intent.pusdIn)} for about ${q} shares`, detail: 'Trades against the pool at the current price. The swap fails if the price moves more than 3%.' },
          { key: 'ap', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Approve the vault', detail: 'So the shares you just bought can start earning.' },
          { key: 'stake', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Stake them to earn revenue', detail: 'Portion.stake(): shares in the vault receive their portion of every payment.' },
        ] }, who, 'Includes the pool’s 0.3% fee. No Portion fee applies to market trades.');
      }
      case 'dexSell': {
        const l = await c.listing(intent.id);
        const have = await c.shareBalance(l.assetId, who.address);
        if (have < BigInt(intent.sharesIn)) throw new UserError('Those shares are inside the vault. Take them out first, then sell.');
        const q = await this.quote(l, 'sell', BigInt(intent.sharesIn));
        if (!q) throw new UserError('There is no market for this listing yet.');
        return this.wrap(`Sell ${intent.sharesIn} shares of ${l.name}`, { tx: swapExactIn(this.chain, [withId(l.assetId), withId(this.need().deployment.pusdAssetId)], BigInt(intent.sharesIn), (q * 97n) / 100n, who.address), steps: [
          { key: 'swap', lane: 'native', pallet: 'AssetConversion', method: 'swapExactTokensForTokens', title: `Swap ${intent.sharesIn} shares for about ${usdLabel(q)}`, detail: 'Trades against the pool at the current price.' },
        ] }, who);
      }
      case 'tokenize':
        return this.prepareTokenize(intent.form, who);
    }
  }

  private async prepareTokenize(f: TokenizeForm, who: Passport): Promise<Prepared> {
    const c = this.need();
    const rules = await this.rules();
    const price = parseUnits(f.pricePusd, 6);
    const bond = parseUnits(f.bondPusd, 6);
    const minPer = parseUnits(f.minPerPeriodPusd, 6);
    const needBond = (BigInt(f.sharesForSale) * price * BigInt(rules.minBondBps)) / 10_000n;
    if (bond < needBond) throw new UserError(`The bond must be at least ${rules.minBondBps / 100}% of the raise.`);
    await this.ensureGas(who, 6n * 10n ** 14n);
    await this.ensurePusd(who, bond);

    const enc = new TextEncoder();
    const cover = f.image ? f.image.bytes : enc.encode(generateCover(f.name, f.category));
    const terms = enc.encode(JSON.stringify({ v: 1, name: f.name, summary: f.summary, category: f.category, terms: f.terms, createdAt: new Date().toISOString() }));
    if (cover.length > MAX_DOC_BYTES) throw new UserError(`The photo is ${(cover.length / 1024).toFixed(0)} KB after compression; the on-chain limit is 32 KB.`);
    if (terms.length > MAX_DOC_BYTES) throw new UserError('The terms are longer than 32 KB.');
    const coverHash = contentHash(cover);
    const docHash = contentHash(terms);

    const plan = await c.planTokenize(who, {
      name: f.name, summary: f.summary, category: f.category, totalShares: f.totalShares, sharesForSale: f.sharesForSale,
      salePrice: price, cadence: f.cadenceSeconds, minPerPeriod: minPer, bond, docHash, coverHash,
    });
    const storage: PlanStep[] = [
      { key: 'doc', lane: 'storage', pallet: 'TransactionStorage', method: 'store', title: 'Store the terms on-chain', detail: `${terms.length.toLocaleString()} bytes, content hash ${docHash.slice(0, 12)}…` },
      { key: 'cover', lane: 'storage', pallet: 'TransactionStorage', method: 'store', title: 'Store the photo on-chain', detail: `${(cover.length / 1024).toFixed(1)} KB, content hash ${coverHash.slice(0, 12)}…` },
    ];
    return {
      title: `Tokenize ${f.name}`,
      steps: [...storage, ...plan.steps],
      cost: `You lock a ${f.bondPusd} pUSD bond and about 3 tPOT of refundable deposits. Fees are a fraction of a cent.`,
      run: async (onStage) => {
        const txs: NonNullable<ActionResult['txs']> = [];
        try {
          onStage('preparing', 'Storing documents', 0);
          for (const [label, bytes] of [['Terms', terms], ['Photo', cover]] as const) {
            const r = await submit(this.chain, storeTx(this.chain, bytes), who.pair);
            if (!r.ok) return { ok: false, error: `${label} could not be stored: ${r.error}`, txs };
            txs.push({ label: `${label} stored`, hash: r.txHash, block: r.blockNumber });
          }
          const out = await submit(this.chain, plan.tx, who.pair, (s, d) => onStage(stageMap[s], d, 2));
          if (!out.ok) return { ok: false, error: out.error, txs, txHash: out.txHash };
          txs.push({ label: 'Atomic tokenize batch', hash: out.txHash, block: out.blockNumber });
          const [found, id] = await c.contract.read('idOfAsset', [plan.assetId]);
          return { ok: true, txHash: out.txHash, blockNumber: out.blockNumber, txs, listingId: found ? Number(id) : undefined };
        } catch (e) {
          return { ok: false, error: (e as Error).message, txs };
        }
      },
    };
  }
}
