import type { ApiPromise } from '@polkadot/api';
import { stringToHex } from '@polkadot/util';
import { assetErc20Address, ss58ToH160 } from './addresses';
import { PortionClient, HEALTH, ESCROW_PHASES, isCore, type Deployment, type EscrowView, type ListingView, type Plan, type PositionView, type TokenizeInput } from './portion';
import type { Passport } from './passport';
import { assetExists } from './chain';
import { ContractError, FALLBACK_LIMITS } from './revive';

export interface CoreDocument {
  v: 1; assetId: number; nftCollection: number; nftItem: number;
  name: string; summary: string; category: number; terms: string; coverHash: string;
}
export interface CoreRecord { assetId: number; docHash: string; createdAt: number; block: number; txHash: string }
export interface CoreSource {
  catalog(): Promise<CoreRecord[]>;
  document(hash: string): Promise<unknown>;
}
export function coreDocument(value: unknown, assetId: number, collection: number): CoreDocument {
  const d = value as CoreDocument;
  if (!d || d.v !== 1 || d.assetId !== assetId || d.nftCollection !== collection || !Number.isSafeInteger(d.nftItem) || d.nftItem < 0
    || typeof d.name !== 'string' || !d.name.trim() || new TextEncoder().encode(d.name).length > 64
    || typeof d.summary !== 'string' || new TextEncoder().encode(d.summary).length > 280
    || typeof d.terms !== 'string' || !d.terms.trim() || !Number.isInteger(d.category) || d.category < 0 || d.category > 7
    || !/^0x[0-9a-f]{64}$/i.test(d.coverHash)) throw new Error('Listing document is unavailable or does not match its native identifiers.');
  return d;
}
const number = (value: unknown): number => {
  const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Chain value exceeds the supported integer range.'); return n;
};
const ZERO = '0x0000000000000000000000000000000000000000';
const address = (value: unknown): string | null => { const a = String(value).toLowerCase(); return a === ZERO ? null : a; };
const HEX32 = /^0x[0-9a-f]{64}$/i;
const H160 = /^0x[0-9a-f]{40}$/i;

/** Reads Core v2's escrow, reviewer, rotation and reserve fields into one view. */
export function escrowView(l: any, tranches: unknown[]): EscrowView {
  const phase = number(l.phase);
  if (phase >= ESCROW_PHASES.length) throw new Error('Unknown funding phase.');
  const raised = BigInt(l.raised), released = BigInt(l.released), refunded = BigInt(l.refunded);
  return {
    phase: ESCROW_PHASES[phase], activated: Boolean(l.activated), reviewer: String(l.reviewer).toLowerCase(),
    recovery: address(l.recovery), pendingOperator: address(l.pendingOperator), pendingAfter: number(l.pendingAfter),
    deadline: number(l.deadline), minSold: number(l.minSold), raised, released, refundPool: BigInt(l.refundPool), refunded,
    escrowed: raised - released - refunded, tranches: tranches.map(number), nextTranche: number(l.nextTranche), lapses: number(l.lapses),
    proposal: l.proposalOpen ? { evidence: String(l.evidence), proposedAt: number(l.proposedAt), approvedAt: number(l.approvedAt), challenged: Boolean(l.challenged) } : null,
    otherDeposits: BigInt(l.otherDeposits), reserve: BigInt(l.reserve), windDownAfter: number(l.windDownAfter),
  };
}

/** Checks Core v2 funding controls before anything is signed. The contract repeats every check. */
export function validateControls(input: TokenizeInput, operatorH160: string, now = Math.floor(Date.now() / 1000)) {
  const c = input.controls;
  if (!c) throw new Error('Core v2 needs a reviewer, a funding target, a deadline and a release schedule.');
  const reviewer = c.reviewer.toLowerCase(), recovery = c.recovery?.toLowerCase();
  if (!H160.test(reviewer) || reviewer === ZERO) throw new Error('Name the reviewer by contract address.');
  if (reviewer === operatorH160.toLowerCase()) throw new Error('The reviewer must be independent of the operator.');
  if (recovery !== undefined && (!H160.test(recovery) || recovery === operatorH160.toLowerCase() || recovery === reviewer)) throw new Error('The recovery address must differ from the operator and the reviewer.');
  if (!Number.isSafeInteger(c.minSold) || c.minSold < 1 || c.minSold > input.sharesForSale) throw new Error('The funding target must be between one share and the shares offered.');
  if (!Number.isSafeInteger(c.deadline) || c.deadline <= now) throw new Error('The funding deadline must be in the future.');
  if (c.tranches.length < 1 || c.tranches.length > 12 || c.tranches.some(t => !Number.isInteger(t) || t < 1) || c.tranches.reduce((a, b) => a + b, 0) !== 10_000) throw new Error('Release tranches must be 1 to 12 whole basis-point parts that add up to 100%.');
  // Mirrors MIN_ANNUAL_BPS: a stated minimum smaller than 2% a year of the offer is refused on-chain.
  if (input.minPerPeriod * 365n * 86_400n * 10_000n < BigInt(input.cadence) * BigInt(input.sharesForSale) * input.salePrice * 200n) throw new Error('The minimum deposit must add up to at least 2% of the offered value each year.');
  return { reviewer, recovery: recovery ?? ZERO };
}

/** Core uses native asset IDs, fixed rules and hash-verified external display documents. v2 adds escrow and named reviewers. */
export class CoreClient extends PortionClient {
  readonly v2: boolean;
  constructor(api: ApiPromise, deployment: Deployment, private source: CoreSource) {
    if (!isCore(deployment)) throw new Error('Core version is required.');
    super(api, deployment);
    this.v2 = deployment.contractVersion === 'core-v2';
  }
  protected callStep(fn: string, args: unknown[]) {
    const deposit = BigInt(fn === 'create' ? (this.v2 ? 80 : 60) : 15) * 10n ** 14n;
    return this.api.tx.revive.call(this.deployment.portion, 0n, FALLBACK_LIMITS.weight, deposit, this.contract.encode(fn, args));
  }
  async count() { return (await this.source.catalog()).length; }
  async listings() { return Promise.all((await this.source.catalog()).map(record => this.readListing(record))); }
  async listing(id: number) {
    const record = (await this.source.catalog()).find(record => record.assetId === id);
    if (!record) throw new Error('This asset has not been published in the verified catalog.');
    return this.readListing(record);
  }
  private async readListing(record: CoreRecord): Promise<ListingView> {
    const l = await this.contract.read('listing', [record.assetId]);
    if (String(l.docHash).toLowerCase() !== record.docHash.toLowerCase()) throw new Error('Published document differs from the contract.');
    const doc = coreDocument(await this.source.document(l.docHash), record.assetId, this.deployment.deedsCollection);
    const health = number(await this.contract.read('health', [record.assetId]));
    if (health > 3) throw new Error('Unknown listing health.');
    const escrow = this.v2 ? escrowView(l, Array.from(await this.contract.read('tranches', [record.assetId]))) : undefined;
    // v2 has no saleOpen flag: a sale is open while funding, before the deadline, with shares left.
    const saleOpen = escrow ? escrow.phase === 'Funding' && number(l.forSale) > 0 && escrow.deadline >= Math.floor(Date.now() / 1000) : Boolean(l.saleOpen);
    return {
      id: record.assetId, operator: String(l.operator).toLowerCase(), payToken: this.pusdToken, assetId: record.assetId,
      nftCollection: doc.nftCollection, nftItem: doc.nftItem, category: doc.category, strikes: null,
      totalShares: number(l.totalShares), cadence: number(l.cadence), createdAt: record.createdAt,
      lastDepositAt: number(l.lastDepositAt), closedAt: number(l.closedAt), saleOpen,
      docHash: String(l.docHash), coverHash: doc.coverHash, minPerPeriod: BigInt(l.minimum), name: doc.name, summary: doc.summary,
      health: HEALTH[health], shareToken: assetErc20Address(record.assetId),
      vault: { totalStaked: BigInt(l.staked), accPerShare: BigInt(l.acc), totalRevenue: BigInt(l.revenue), deposits: null,
        bond: BigInt(l.bond), forSale: number(l.forSale), sold: number(l.sold), salePrice: BigInt(l.price) },
      ...(escrow ? { escrow } : {}),
    };
  }
  async positions(address: string) {
    return (await Promise.all((await this.source.catalog()).map(async record => {
      const who = ss58ToH160(address);
      const [stake, pending] = await Promise.all([this.contract.read('stakes', [record.assetId, who]), this.contract.read('pending', [record.assetId, who])]);
      const position: PositionView = { id: record.assetId, staked: number(stake.amount), pending: BigInt(pending) };
      if (!this.v2) return position;
      const [l, paid, taken] = await Promise.all([this.contract.read('listing', [record.assetId]), this.contract.read('paid', [record.assetId, who]), this.contract.read('refundTaken', [record.assetId, who])]);
      const refundable = number(l.phase) === 3 && !taken && BigInt(l.raised) > 0n ? BigInt(l.refundPool) * BigInt(paid) / BigInt(l.raised) : 0n;
      return { ...position, refundable };
    }))).filter((position: PositionView) => position.staked > 0 || position.pending > 0n || (position.refundable ?? 0n) > 0n);
  }
  async rules() {
    const [payment, nativeShare, treasury] = await Promise.all([this.contract.read('paymentToken'),this.contract.read('shareToken',[this.deployment.pusdAssetId]),this.contract.read('treasury')]);
    const token = String(payment).toLowerCase();
    if (token !== this.pusdToken.toLowerCase()) throw new Error('Core payment asset does not match deployment configuration.');
    if (String(nativeShare).toLowerCase() !== assetErc20Address(this.deployment.pusdAssetId).toLowerCase()) throw new Error('Core native share-address mapping differs from the configured runtime.');
    if (String(treasury).toLowerCase() !== ss58ToH160(this.deployment.treasury).toLowerCase()) throw new Error('Core treasury differs from the disclosed deployment account.');
    if (this.v2) {
      const guardian = String(await this.contract.read('guardian')).toLowerCase();
      if (guardian !== (this.deployment.guardian ?? ZERO).toLowerCase()) throw new Error('Core guardian differs from the disclosed deployment configuration.');
    }
    return { saleFeeBps: 100, revenueFeeBps: 50, minBondBps: 500, slashTipBps: 100, minCadence: 60 }; }
  async freeAssetId() {
    for (let attempt = 0; attempt < 25; attempt++) {
      const id = 100_000 + Math.floor(Math.random() * 900_000);
      if (await assetExists(this.api, id)) continue;
      try { await this.contract.read('listing', [id]); }
      catch (error) { if (error instanceof ContractError && error.data === this.contract.iface.getError('Invalid')!.selector) return id; throw error; }
    }
    throw new Error('Could not allocate an unused native asset ID.');
  }
  async planTokenize(operator: Passport, input: TokenizeInput): Promise<Plan & { assetId: number; nftItem: number }> {
    const assetId = input.assetId!; const nftItem = input.nftItem!;
    if (!Number.isSafeInteger(assetId) || !Number.isSafeInteger(nftItem)) throw new Error('Allocate native identifiers before hashing the Core document.');
    const terms = { asset: assetId, totalShares: input.totalShares, forSale: input.sharesForSale, cadence: input.cadence,
      price: input.salePrice, minimum: input.minPerPeriod, bond: input.bond, docHash: input.docHash };
    const controls = this.v2 ? validateControls(input, operator.h160) : null;
    const tx = this.api.tx.utility.batchAll([
      this.api.tx.nfts.mint(this.deployment.deedsCollection, nftItem, operator.address, null),
      this.api.tx.nfts.setAttribute(this.deployment.deedsCollection, nftItem, { ItemOwner: null }, stringToHex('portion'), input.docHash),
      this.api.tx.nftFractionalization.fractionalize(this.deployment.deedsCollection, nftItem, assetId, operator.address, input.totalShares),
      this.approve(assetId, BigInt(input.sharesForSale)), this.approve(this.deployment.pusdAssetId, input.bond),
      this.callStep('create', [controls ? { ...terms, recovery: controls.recovery, reviewer: controls.reviewer, minSold: input.controls!.minSold,
        deadline: input.controls!.deadline, tranches: input.controls!.tranches } : terms]),
    ]);
    const detail = controls
      ? 'One atomic batch creates the NFT, fractionalizes it, escrows offered shares and the operator bond, and registers Core v2 terms. No sale opens until the named reviewer attests.'
      : 'One atomic batch creates the NFT, fractionalizes it, escrows offered shares and the operator bond, and registers Core v1 terms.';
    return { tx, assetId, nftItem, steps: [{ key: 'create', lane: 'native', pallet: 'Utility', method: 'batchAll', title: 'Create the native deed, shares and funding offer', detail }] };
  }
  planBuy(listing: ListingView, shares: number): Plan {
    const plan = super.planBuy(listing, shares);
    if (!this.v2) return plan;
    const detail = 'Your payment is held by the contract, not paid to the operator. It is released in reviewer-approved tranches, or refunded if the raise misses its target.';
    return { ...plan, steps: plan.steps.map(step => step.key === 'buy' ? { ...step, detail } : step) };
  }
  private v2Call(fn: string, args: unknown[], title: string, detail: string): Plan {
    if (!this.v2) throw new Error('This action needs Core v2.');
    return { tx: this.callStep(fn, args), steps: [{ key: fn, lane: 'evm', pallet: 'Revive', method: 'call', title, detail }] };
  }
  planAttest(id: number, evidence: string) {
    if (!HEX32.test(evidence)) throw new Error('Attach the hash of the reviewer’s evidence.');
    return this.v2Call('attest', [id, evidence], 'Record your review', 'Opens the sale. Your address and evidence hash are recorded on-chain.');
  }
  planFinalize(id: number) { return this.v2Call('finalize', [id], 'Settle the raise', 'Anyone may settle once the offer sells out or the deadline passes. A missed target opens full refunds.'); }
  planRefund(id: number) { return this.v2Call('refund', [id], 'Take back your payment', 'Returns your share of the purchase money the operator never received.'); }
  planCancel(id: number) { return this.v2Call('cancel', [id], 'Cancel the raise', 'Returns every unreleased payment to buyers. Money already released cannot be recovered.'); }
  planPropose(id: number, evidence: string) {
    if (!HEX32.test(evidence)) throw new Error('Attach the hash of the evidence for this tranche.');
    return this.v2Call('propose', [id, evidence], 'Request the next tranche', 'The reviewer must approve, then holders have one period to challenge.');
  }
  planApprove(id: number) { return this.v2Call('approve', [id], 'Approve the tranche', 'Starts the one-period challenge window.'); }
  planChallenge(id: number) { return this.v2Call('challenge', [id], 'Challenge the tranche', 'Needs at least 10% of sold shares staked. Two failed tranches return the unreleased money to buyers.'); }
  planRelease(id: number) { return this.v2Call('release', [id], 'Release the tranche', 'Pays the approved share of escrow to the operator, less the 1% sale fee.'); }
  planLapse(id: number) { return this.v2Call('lapse', [id], 'Clear the failed tranche', 'A second failure opens refunds of unreleased money.'); }
  planNoticeWindDown(id: number) { return this.v2Call('noticeWindDown', [id], 'Give notice of wind-down', 'Holders get two periods to respond before the listing can close.'); }
  planProposeOperator(id: number, next: string) {
    if (!H160.test(next)) throw new Error('Name the new operator by contract address.');
    return this.v2Call('proposeOperator', [id, next], 'Propose a new operator', 'The new operator can accept after one period.');
  }
  planAcceptOperator(id: number) { return this.v2Call('acceptOperator', [id], 'Accept the operator role', 'You become responsible for deposits from now on.'); }
  planOperator(fn: 'closeSale' | 'windDown' | 'withdrawBond', id: number): Plan {
    if (this.v2 && fn === 'closeSale') throw new Error('Core v2 settles a sale with finalize, not closeSale.');
    return super.planOperator(fn, id);
  }
  quoteBuy(listing: ListingView, shares: number, saleFeeBps: number) {
    const quote = super.quoteBuy(listing, shares, saleFeeBps);
    // v2 takes the fee on each released tranche; at purchase the whole amount goes into escrow.
    return this.v2 ? { ...quote, toOperator: 0n, escrowed: quote.cost } : quote;
  }
  planDeposit(listing: ListingView, amount: bigint): Plan {
    return { tx: this.api.tx.utility.batchAll([this.approve(this.deployment.pusdAssetId, amount), this.callStep('deposit', [listing.id, amount])]),
      steps: [{ key: 'deposit', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Deposit business revenue', detail: 'The fixed 0.5% fee is deducted; a qualifying operator payment resets the payment deadline.' }] };
  }
  planTopUpBond(listing: ListingView, amount: bigint): Plan {
    return { tx: this.api.tx.utility.batchAll([this.approve(this.deployment.pusdAssetId, amount), this.callStep('topUp', [listing.id, amount])]),
      steps: [{ key: 'bond', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Top up the operator bond', detail: 'Approve and escrow the specified pUSD amount.' }] };
  }
}

/** Add native-account mapping only when the runtime cannot yet resolve this wallet's contract address. */
export async function mappedCorePlan(api: ApiPromise, plan: Plan, who: Passport): Promise<Plan> {
  const mapped = (await (api.call as any).reviveApi.accountId(who.h160)).toString();
  if (mapped === who.address) return plan;
  const registered: any = await api.query.revive.originalAccount(who.h160);
  if (registered.isSome) throw new Error('This contract address is already linked to another native account.');
  const calls = plan.tx.method.section === 'utility' && plan.tx.method.method === 'batchAll'
    ? Array.from(plan.tx.method.args[0] as any) : [plan.tx.method];
  return {
    tx: api.tx.utility.batchAll([api.tx.revive.mapAccount().method, ...calls]),
    steps: [{ key: 'map', lane: 'native', pallet: 'Revive', method: 'mapAccount', title: 'Link your existing account to contract signing', detail: 'Registers the native-to-contract address mapping. This may lock a native storage deposit; no new wallet is created.' }, ...plan.steps],
  };
}
