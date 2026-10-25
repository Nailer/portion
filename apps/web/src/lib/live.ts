import type { ApiPromise } from '@polkadot/api';
import {
  createPoolAndSeed, quoteExactIn, reserves, swapExactIn, withId, FALLBACK_LIMITS,
  PortionClient, CoreClient, mappedCorePlan, assetBalance, contentHash, nativeFree, parseUnits, storeTx, submit, MAX_DOC_BYTES,
  TESTNET, UnconfirmedTransactionError, type Deployment, type ListingView, type Passport, type Plan, type PlanStep, type TxStage,
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
    if (deployment?.portion && Number.isSafeInteger(deployment.pusdAssetId) && deployment.deedsCollection !== undefined) this.client = deployment.contractVersion === 'core-v1' ? new CoreClient(chain, deployment, { catalog: () => http('/api/catalog'), document: hash => this.docJson(hash) }) : new PortionClient(chain, deployment);
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
    return this.need().listings();
  }
  listing(id: number) {
    return this.need().listing(id);
  }
  positions(a: string) {
    return this.need().positions(a);
  }
  async balances(address: string): Promise<Balances> {
    const pot = await nativeFree(this.chain, address);
    const pusd = this.deployment ? await assetBalance(this.chain, this.deployment.pusdAssetId, address) : null;
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
      if (!r.ok) return null;
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length > MAX_DOC_BYTES || contentHash(bytes).toLowerCase() !== hash.toLowerCase()) return null;
      return JSON.parse(new TextDecoder().decode(bytes));
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
    return http<ActivityRow[]>(`/api/activity?${p}`);
  }
  async revenue(id: number) {
    const rows = await http<{ ts: number; amount: string; kind: 'revenue' | 'slash' }[]>(`/api/listings/${id}/revenue`);
    return rows.map(r => ({ ...r, amount: BigInt(r.amount) }));
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

  private async wrap(title: string, plan: Plan, who: Passport, cost?: string): Promise<Prepared> {
    if (this.client instanceof CoreClient) plan = await mappedCorePlan(this.chain, plan, who);
    return {
      title,
      steps: plan.steps,
      cost,
      run: async (onStage) => {
        try {
          const out = await submit(this.chain, plan.tx, who.pair, (s, d) => onStage(stageMap[s], d));
          let warning: string | undefined;
          if (out.ok && this.deployment?.contractVersion === 'core-v1') {
            try { await http('/api/receipts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: out.blockNumber, txHash: out.txHash }) }); }
            catch { warning = 'Transaction finalized, but its history receipt could not be published. Keep the transaction hash.'; }
          }
          return { ok: out.ok, txHash: out.txHash, blockNumber: out.blockNumber, error: out.error, warning };
        } catch (e) {
          return { ok: false, error: (e as Error).message, ...(e instanceof UnconfirmedTransactionError ? { unconfirmed: true, txHash: e.txHash } : {}) };
        }
      },
    };
  }

  async prepare(intent: Intent, who: Passport): Promise<Prepared> {
    const c = this.need();
    await this.ensureGas(who);
    switch (intent.kind) {
      case 'buy': {
        const proof = await this.proof(intent.id);
        if (!proof?.verified) throw new UserError('Buying is unavailable until the listing’s native backing checks pass.');
        const l = await c.listing(intent.id);
        if (!l.saleOpen) throw new UserError('This sale is closed.');
        if (intent.shares < 1 || intent.shares > l.vault.forSale) throw new UserError(`Only ${l.vault.forSale} shares are available.`);
        const cost = BigInt(intent.shares) * l.vault.salePrice;
        await this.ensurePusd(who, cost);
        return this.wrap(`Buy ${intent.shares} share${intent.shares === 1 ? '' : 's'} of ${l.name}`, c.planBuy(l, intent.shares), who, 'Your pUSD goes to the operator after the contract’s sale fee.');
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
        return this.wrap('Slash the operator bond', c.planSlash(intent.id), who, 'The contract determines the caller tip and allocation to share-holders.');
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
          { key: 'pool', lane: 'native', pallet: 'AssetConversion', method: 'createPool', title: 'Create the share / pUSD pool', detail: 'A native Uniswap-style pool. Review the chain’s setup deposit before signing.' },
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
        ] }, who, 'The live pool quote includes its trading fee.');
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

    const core = c instanceof CoreClient;
    const identifiers = core ? { assetId: await c.freeAssetId(), nftItem: await c.freeNftItem() } : undefined;
    const enc = new TextEncoder();
    if (!f.image) throw new UserError('Upload an actual image of the asset.');
    const cover = f.image.bytes;
    const terms = enc.encode(JSON.stringify({ v: 1, ...identifiers, nftCollection: this.deployment!.deedsCollection, coverHash: contentHash(cover), sharesForSale: f.sharesForSale, name: f.name, summary: f.summary, category: f.category, terms: f.terms }));
    if (cover.length > MAX_DOC_BYTES) throw new UserError(`The photo is ${(cover.length / 1024).toFixed(0)} KB after compression; the on-chain limit is 32 KB.`);
    if (terms.length > MAX_DOC_BYTES) throw new UserError('The terms are longer than 32 KB.');
    const coverHash = contentHash(cover);
    const docHash = contentHash(terms);

    const originalPlan = await c.planTokenize(who, {
      ...identifiers, name: f.name, summary: f.summary, category: f.category, totalShares: f.totalShares, sharesForSale: f.sharesForSale,
      salePrice: price, cadence: f.cadenceSeconds, minPerPeriod: minPer, bond, docHash, coverHash,
    });
    const mappedPlan = core ? await mappedCorePlan(this.chain, originalPlan, who) : originalPlan;
    const plan = { ...originalPlan, tx: mappedPlan.tx, steps: mappedPlan.steps };
    const storage: PlanStep[] = [
      { key: 'doc', lane: 'storage', pallet: 'TransactionStorage', method: 'store', title: 'Store the terms on-chain', detail: `${terms.length.toLocaleString()} bytes, content hash ${docHash.slice(0, 12)}…` },
      { key: 'cover', lane: 'storage', pallet: 'TransactionStorage', method: 'store', title: 'Store the photo on-chain', detail: `${(cover.length / 1024).toFixed(1)} KB, content hash ${coverHash.slice(0, 12)}…` },
    ];
    return {
      title: `Tokenize ${f.name}`,
      steps: [...storage, ...plan.steps],
      cost: `You lock a ${f.bondPusd} pUSD bond. Network fees and storage deposits are additional; review them in your wallet.`,
      run: async (onStage) => {
        const txs: NonNullable<ActionResult['txs']> = [];
        try {
          onStage('preparing', 'Storing documents', 0);
          for (const [label, bytes] of [['Terms', terms], ['Photo', cover]] as const) {
            const r = await submit(this.chain, storeTx(this.chain, bytes), who.pair);
            if (!r.ok) return { ok: false, error: `${label} could not be stored: ${r.error}`, txs };
            txs.push({ label: `${label} stored`, hash: r.txHash, block: r.blockNumber });
            if (core) {
              try { await http(`/api/doc/${contentHash(bytes)}/pin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: r.blockNumber }) }); }
              catch { return { ok: false, error: `${label} is finalized on-chain, but its public copy could not be published. Keep the receipt and retry publication before creating the listing.`, txs }; }
            }
          }
          const out = await submit(this.chain, plan.tx, who.pair, (s, d) => onStage(stageMap[s], d, 2));
          if (!out.ok) return { ok: false, error: out.error, txs, txHash: out.txHash };
          txs.push({ label: 'Atomic tokenize batch', hash: out.txHash, block: out.blockNumber });
          if (core) {
            let warning: string | undefined;
            try { await http('/api/receipts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: out.blockNumber, txHash: out.txHash }) }); }
            catch { warning = 'Asset creation finalized, but publication is pending. Keep the receipt; do not create the asset again.'; }
            return { ok: true, txHash: out.txHash, blockNumber: out.blockNumber, txs, listingId: plan.assetId, warning };
          }
          const [found, id] = await c.contract.read('idOfAsset', [plan.assetId]);
          return { ok: true, txHash: out.txHash, blockNumber: out.blockNumber, txs, listingId: found ? Number(id) : undefined };
        } catch (e) {
          return { ok: false, error: (e as Error).message, txs, ...(e instanceof UnconfirmedTransactionError ? { unconfirmed: true, txHash: e.txHash } : {}) };
        }
      },
    };
  }
}
