import type { ApiPromise } from '@polkadot/api';
import {
  createPoolAndSeed, quoteExactIn, reserves, swapExactIn, withId, FALLBACK_LIMITS,
  PortionClient, CoreClient, isCore, mappedCorePlan, assetBalance, contentHash, nativeFree, parseUnits, storeTx, submit, MAX_DOC_BYTES,
  TESTNET, UnconfirmedTransactionError, testCreditMessage, type Deployment, type ListingView, type Passport, type Plan, type PlanStep, type TxStage,
} from '@portion/sdk';
import {
  api as http, API_BASE, UserError,
  type ActionResult, type ActivityRow, type Backend, type Balances, type DocMeta, type DripResult, type Intent,
  type PoolView, type Prepared, type ProofView, type Rules, type StageName, type TokenizeForm,
} from './backend';
import { nativeFeeReview } from './fee-review';
import { formatUnits } from '@portion/sdk/units';
import { loadUpload, saveUpload, type UploadCheckpoint, type UploadReceipt } from './upload-checkpoint';
import { reserveLocalReceipt, settleLocalReceipt } from './receipt-journal';
import { stringToHex } from '@polkadot/util';
import { walletAddress } from './wallet';

const usdLabel = (v: bigint) => `${formatUnits(v,6,6)} pUSD`;
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
    if (deployment?.portion && Number.isSafeInteger(deployment.pusdAssetId) && deployment.deedsCollection !== undefined) this.client = isCore(deployment) ? new CoreClient(chain, deployment, { catalog: () => http('/api/catalog'), document: hash => this.docJson(hash) }) : new PortionClient(chain, deployment);
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
      const r = await fetch(this.docUrl(hash), { signal: AbortSignal.timeout(10000) });
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
  async drip(address: string, who: Passport) {
    if(walletAddress(address)!==who.address || !('signer' in who.pair) || !who.pair.signer.signRaw) throw new UserError('Connect the recipient native wallet with message-signing support before requesting credits.');
    const challenge = await http<{address:string;day:string;message:string}>(`/api/faucet/challenge?address=${encodeURIComponent(who.address)}`);
    if(challenge.address!==who.address || !/^\d{4}-\d{2}-\d{2}$/.test(challenge.day) || !this.deployment || challenge.message!==testCreditMessage(who.address,challenge.day,this.deployment.portion)) throw new UserError('The credit challenge does not match this recipient, deployment and purpose. Nothing was signed.');
    const signed=await who.pair.signer.signRaw({address:who.pair.address,data:stringToHex(challenge.message),type:'bytes'});
    return http<DripResult>('/api/drip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address:who.address,signature:signed.signature }) });
  }

  // ───────────── actions ─────────────

  private async ensureGas(who: Passport, min = 1n * 10n ** 14n) {
    const free = await nativeFree(this.chain, who.address);
    if (free < min) throw new UserError('Your wallet needs tPOT for network fees and storage deposits.', 'faucet');
  }

  private async ensurePusd(who: Passport, need: bigint) {
    const have = await assetBalance(this.chain, this.need().deployment.pusdAssetId, who.address);
    if (have < need) throw new UserError('You do not have enough pUSD for this. Get some from the faucet.', 'faucet');
  }

  prepareNativeTool(title: string, plan: Plan, who: Passport, cost?: string) {
    return this.wrap(title,plan,who,cost,false);
  }

  private async wrap(title: string, plan: Plan, who: Passport, cost?: string, coreReceipt = true): Promise<Prepared> {
    if (coreReceipt && this.client instanceof CoreClient) plan = await mappedCorePlan(this.chain, plan, who);
    const quote = await nativeFeeReview(this.chain, [plan.tx], who.address);
    return {
      title,
      steps: plan.steps,
      cost,
      nativeReview: quote.review,
      run: async (onStage) => {
        let receiptId: string | undefined;
        try {
          await quote.check(0);
          const nonce = (await this.chain.rpc.system.accountNextIndex(who.address)).toString();
          receiptId = reserveLocalReceipt(localStorage,who.address,title,plan.tx.method.hash.toHex(),nonce);
          const out = await submit(this.chain, plan.tx, who.pair, (s, d) => onStage(stageMap[s], d),{nonce});
          let warning: string | undefined;
          try { settleLocalReceipt(localStorage,receiptId,{ok:out.ok,txHash:out.txHash,blockNumber:out.blockNumber}); }
          catch { warning = 'The local submission receipt could not be updated. Keep the finalized hash and reconcile it before repeating this action.'; }
          if (out.ok && coreReceipt && isCore(this.deployment)) {
            try { await http('/api/receipts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: out.blockNumber, txHash: out.txHash }) }); }
            catch { warning = [warning,'Transaction finalized, but its history receipt could not be published. Keep the transaction hash.'].filter(Boolean).join(' '); }
          }
          return { ok: out.ok, txHash: out.txHash, blockNumber: out.blockNumber, error: out.error, warning, receiptId };
        } catch (e) {
          const result: ActionResult = { ok: false, error: (e as Error).message, receiptId, ...(e instanceof UnconfirmedTransactionError ? { unconfirmed: true, txHash: e.txHash } : {}) };
          if (receiptId) { try { settleLocalReceipt(localStorage,receiptId,result); } catch { /* Preserve the pending record. */ } }
          return result;
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
        if (l.health === 'Defaulted' || l.health === 'WoundDown') throw new UserError('New funding is blocked for this listing.');
        if (!l.saleOpen) throw new UserError('This sale is closed.');
        if (intent.shares < 1 || intent.shares > l.vault.forSale) throw new UserError(`Only ${l.vault.forSale} shares are available.`);
        const cost = BigInt(intent.shares) * l.vault.salePrice;
        await this.ensurePusd(who, cost);
        const note = l.escrow
          ? `You pay ${usdLabel(cost)}. The contract holds it and releases it to the operator only in reviewer-approved tranches; if the raise misses its target you can take it all back.`
          : `You pay ${usdLabel(cost)}. This includes the sale fee; the remainder goes directly to the operator, without spending controls.`;
        const prepared = await this.wrap(`Buy ${intent.shares} share${intent.shares === 1 ? '' : 's'} of ${l.name}`, c.planBuy(l, intent.shares), who, note);
        const run = prepared.run;
        return { ...prepared, run: async stage => {
          const latest = await c.listing(intent.id);
          if (!latest.saleOpen || latest.vault.forSale < intent.shares || latest.vault.salePrice !== l.vault.salePrice || latest.health === 'Defaulted' || latest.health === 'WoundDown') throw new UserError('The offer changed. Start a new review before buying.');
          await this.ensurePusd(who, cost);
          return run(stage);
        } };
      }
      case 'claim': {
        if (!intent.ids.length) throw new UserError('Nothing to claim yet.');
        return this.wrap(intent.ids.length === 1 ? 'Claim revenue' : `Claim revenue from ${intent.ids.length} listings`, c.planClaim(intent.ids), who);
      }
      case 'deposit': {
        const l = await c.listing(intent.id);
        await this.ensurePusd(who, intent.amount);
        const fee = intent.amount * BigInt((await this.rules()).revenueFeeBps) / 10000n;
        return this.wrap(`Deposit revenue into ${l.name}`, c.planDeposit(l, intent.amount), who, `Deposit ${usdLabel(intent.amount)} including ${usdLabel(fee)} fee. ${usdLabel(intent.amount-fee)} is allocated to current stakers; holders claim it separately.`);
      }
      case 'stake': {
        const l = await c.listing(intent.id);
        const bal = await c.shareBalance(l.assetId, who.address);
        if (bal < BigInt(intent.amount)) throw new UserError('You hold fewer wallet shares than that.');
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
      case 'escrow': {
        if (!(c instanceof CoreClient) || !c.v2) throw new UserError('This action needs the Core v2 contract.');
        const id = intent.id, ev = intent.evidence ?? '';
        const plans = {
          attest: () => c.planAttest(id, ev), finalize: () => c.planFinalize(id), refund: () => c.planRefund(id), cancel: () => c.planCancel(id),
          propose: () => c.planPropose(id, ev), approve: () => c.planApprove(id), challenge: () => c.planChallenge(id),
          release: () => c.planRelease(id), lapse: () => c.planLapse(id), noticeWindDown: () => c.planNoticeWindDown(id),
        } as const;
        const plan = plans[intent.fn]();
        return this.wrap(plan.steps[0].title, plan, who);
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
      case 'guardian':
        throw new UserError('Pausing needs the Core v2 guardian. The live deployment is Core v1.');
    }
  }

  private async prepareTokenize(f: TokenizeForm, who: Passport): Promise<Prepared> {
    const c = this.need();
    if (!(c instanceof CoreClient)) throw new UserError('The recoverable creation flow requires a Core contract.');
    if (c.v2 && !f.controls) throw new UserError('Name the reviewer, the funding target, the deadline and the release schedule.');
    const rules = await this.rules();
    const price = parseUnits(f.pricePusd, 6), bond = parseUnits(f.bondPusd, 6), minPer = parseUnits(f.minPerPeriodPusd, 6);
    const needBond = BigInt(f.sharesForSale) * price * BigInt(rules.minBondBps) / 10000n;
    if (bond < needBond) throw new UserError(`The bond must be at least ${rules.minBondBps / 100}% of the raise.`);
    if (!f.image) throw new UserError('Upload the actual asset photo. To resume, select the same photo and business terms.');
    const enc = new TextEncoder(), cover = f.image.bytes;
    if (cover.length > MAX_DOC_BYTES) throw new UserError('The compressed photo exceeds the on-chain document limit.');
    const coverHash = contentHash(cover);
    const fingerprint = contentHash(enc.encode(JSON.stringify({ owner: who.address, contract: this.deployment!.portion,
      name: f.name, summary: f.summary, category: f.category, terms: f.terms, totalShares: f.totalShares,
      sharesForSale: f.sharesForSale, price: price.toString(), cadence: f.cadenceSeconds, minimum: minPer.toString(), bond: bond.toString(), coverHash,
      ...(f.controls ? { controls: f.controls } : {}) })));
    let checkpoint = loadUpload(localStorage, fingerprint);
    if (!checkpoint) {
      checkpoint = { v: 1, fingerprint, owner: who.address, contract: this.deployment!.portion,
        assetId: await c.freeAssetId(), nftItem: await c.freeNftItem(), documents: {} };
      saveUpload(localStorage, checkpoint);
    }
    const saved: UploadCheckpoint = checkpoint;
    if (saved.owner !== who.address || saved.contract.toLowerCase() !== this.deployment!.portion.toLowerCase()) throw new UserError('The saved upload belongs to another wallet or deployment.');
    if (saved.pending) throw new UserError(`The earlier ${saved.pending.stage.toLowerCase()} transaction is unconfirmed. Check its exact hash and finalized block in the receipt centre before continuing.`);
    const identifiers = { assetId: saved.assetId, nftItem: saved.nftItem };
    const terms = enc.encode(JSON.stringify({ v: 1, ...identifiers, nftCollection: this.deployment!.deedsCollection, coverHash,
      sharesForSale: f.sharesForSale, name: f.name, summary: f.summary, category: f.category, terms: f.terms }));
    if (terms.length > MAX_DOC_BYTES) throw new UserError('The terms exceed the on-chain document limit.');
    const docHash = contentHash(terms);
    const blockOf = async (receipt: UploadReceipt) => receipt.blockNumber ?? (await this.chain.rpc.chain.getHeader(receipt.blockHash)).number.toNumber();
    const publishCreation = async (): Promise<ActionResult> => {
      const receipt = saved.creation!;
      const actual = await c.contract.read('listing', [saved.assetId]);
      if (String(actual.docHash).toLowerCase() !== docHash.toLowerCase() || String(actual.operator).toLowerCase() !== who.h160.toLowerCase()) throw new UserError('The finalized listing does not match this upload. Do not create it again.');
      const blockNumber = await blockOf(receipt);
      let warning: string | undefined;
      try { await http('/api/receipts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: blockNumber, txHash: receipt.txHash }) }); }
      catch { warning = 'Creation finalized, but public receipt publication is pending. Retry publication, not asset creation.'; }
      return { ok: true, txHash: receipt.txHash, blockNumber, listingId: saved.assetId, warning };
    };
    if (saved.creation) return { title: `Publish existing ${f.name} receipt`, steps: [], cost: 'This reuses the finalized creation transaction. No new chain transaction is needed.', run: publishCreation };
    await this.ensureGas(who, 6n * 10n ** 14n); await this.ensurePusd(who, bond);
    const input = { ...identifiers, name: f.name, summary: f.summary, category: f.category, totalShares: f.totalShares,
      sharesForSale: f.sharesForSale, salePrice: price, cadence: f.cadenceSeconds, minPerPeriod: minPer, bond, docHash, coverHash,
      ...(c.v2 && f.controls ? { controls: { reviewer: f.controls.reviewer, recovery: f.controls.recovery || undefined, minSold: f.controls.minSold,
        deadline: Math.floor(Date.now() / 1000) + f.controls.deadlineDays * 86_400, tranches: f.controls.tranches } } : {}) };
    const original = await c.planTokenize(who,input);
    const plan = await mappedCorePlan(this.chain, original, who);
    const documentTxs = { Terms: storeTx(this.chain,terms), Photo: storeTx(this.chain,cover) };
    const remaining: typeof plan.tx[] = [];
    const quoteIndex = new Map<string,number>();
    for (const label of ['Terms','Photo'] as const) if (!saved.documents[label]) { quoteIndex.set(label,remaining.length); remaining.push(documentTxs[label]); }
    quoteIndex.set('Creation',remaining.length); remaining.push(plan.tx);
    const quote = await nativeFeeReview(this.chain,remaining,who.address);
    const steps: PlanStep[] = (['Terms','Photo'] as const).map(label => ({ key: label, lane: 'storage', pallet: 'TransactionStorage', method: saved.documents[label] ? 'reuse' : 'store',
      title: saved.documents[label] ? `Reuse finalized ${label.toLowerCase()}` : `Store ${label.toLowerCase()} on-chain`, detail: saved.documents[label] ? 'Retry only verified public-copy publication; no second store.' : `${label === 'Terms' ? terms.length : cover.length} bytes; a separate signature is required.` }));
    return { title: `Tokenize ${f.name}`, recoveryKey: fingerprint, steps: [...steps,...plan.steps], nativeReview: quote.review,
      cost: `Lock ${f.bondPusd} pUSD as the operator bond. Native execution fees and additional storage deposits are separate. Accepted document steps are reused.`,
      run: async onStage => {
        const txs: NonNullable<ActionResult['txs']> = [];
        const send = async (stage: 'Terms' | 'Photo' | 'Creation', tx: typeof plan.tx) => {
          const current = loadUpload(localStorage,fingerprint);
          if (!current || current.pending || current.creation || current.assetId !== saved.assetId || current.nftItem !== saved.nftItem) throw new UserError('Upload state changed. Start a new review; no automatic retry was made.');
          await quote.check(quoteIndex.get(stage)!);
          const nonce = (await this.chain.rpc.system.accountNextIndex(who.address)).toString();
          saved.pending = { stage, callHash: tx.method.hash.toHex(), nonce }; saveUpload(localStorage,saved);
          let out;
          try { out = await submit(this.chain,tx,who.pair,(s,d) => onStage(stageMap[s],d),{ nonce }); }
          catch (error) {
            if (error instanceof UnconfirmedTransactionError) { if (error.txHash) saved.pending.txHash = error.txHash; }
            else delete saved.pending;
            saveUpload(localStorage,saved); throw error;
          }
          delete saved.pending;
          if (out.ok) {
            const receipt = { txHash: out.txHash, blockHash: out.blockHash, blockNumber: out.blockNumber };
            if (stage === 'Creation') saved.creation = receipt; else saved.documents[stage] = receipt;
          }
          try { saveUpload(localStorage,saved); }
          catch { throw new UnconfirmedTransactionError('Finalized receipt could not be saved locally; reconcile it before retrying',out.txHash); }
          return out;
        };
        try {
          for (const label of ['Terms','Photo'] as const) {
            onStage('preparing',saved.documents[label] ? `Reusing finalized ${label.toLowerCase()}` : `Storing ${label.toLowerCase()}`);
            if (!saved.documents[label]) {
              const out = await send(label,documentTxs[label]);
              if (!out.ok) return { ok: false, error: `${label} failed on-chain: ${out.error}`, txs, txHash: out.txHash, blockNumber: out.blockNumber };
            }
            const receipt = saved.documents[label]!; const block = await blockOf(receipt);
            txs.push({ label: `${label} stored`, hash: receipt.txHash, block });
            try { await http(`/api/doc/${label === 'Terms' ? docHash : coverHash}/pin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block }) }); }
            catch { return { ok: false, error: `${label} is finalized. Its public copy is pending; repeat the same form/photo to resume publication without another store.`, txs }; }
          }
          const [asset,item] = await Promise.all([this.chain.query.assets.asset(saved.assetId),this.chain.query.nfts.item(this.deployment!.deedsCollection,saved.nftItem)]);
          if ((asset as any).isSome || (item as any).isSome) throw new UserError('The allocated asset or deed identifier is now occupied. Check existing receipts; changed identifiers require new immutable terms and a new review.');
          const out = await send('Creation',plan.tx);
          if (!out.ok) return { ok: false, error: out.error, txs, txHash: out.txHash, blockNumber: out.blockNumber };
          txs.push({ label: 'Atomic tokenize batch', hash: out.txHash, block: out.blockNumber });
          try { return { ...await publishCreation(), txs }; }
          catch { return { ok: true, txHash: out.txHash, blockNumber: out.blockNumber, listingId: saved.assetId, txs,
            warning: 'Creation finalized, but its listing/public receipt could not be checked. Keep these hashes and retry receipt publication; do not create it again.' }; }
        } catch (error) {
          return { ok: false, error: (error as Error).message, txs,
            ...(error instanceof UnconfirmedTransactionError ? { unconfirmed: true, txHash: error.txHash } : {}) };
        }
      },
    };
  }
}
