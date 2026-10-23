import type { ApiPromise } from '@polkadot/api';
import { stringToHex } from '@polkadot/util';
import { assetErc20Address, ss58ToH160 } from './addresses';
import { PortionClient, HEALTH, type Deployment, type ListingView, type Plan, type TokenizeInput } from './portion';
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
/** Core v1 uses native asset IDs, fixed rules and hash-verified external display documents. */
export class CoreClient extends PortionClient {
  constructor(api: ApiPromise, deployment: Deployment, private source: CoreSource) {
    if (deployment.contractVersion !== 'core-v1') throw new Error('Core version is required.');
    super(api, deployment);
  }
  protected callStep(fn: string, args: unknown[]) {
    const deposit = BigInt(fn === 'create' ? 60 : 15) * 10n ** 14n;
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
    return {
      id: record.assetId, operator: String(l.operator).toLowerCase(), payToken: this.pusdToken, assetId: record.assetId,
      nftCollection: doc.nftCollection, nftItem: doc.nftItem, category: doc.category, strikes: null,
      totalShares: number(l.totalShares), cadence: number(l.cadence), createdAt: record.createdAt,
      lastDepositAt: number(l.lastDepositAt), closedAt: number(l.closedAt), saleOpen: Boolean(l.saleOpen),
      docHash: String(l.docHash), coverHash: doc.coverHash, minPerPeriod: BigInt(l.minimum), name: doc.name, summary: doc.summary,
      health: HEALTH[health], shareToken: assetErc20Address(record.assetId),
      vault: { totalStaked: BigInt(l.staked), accPerShare: BigInt(l.acc), totalRevenue: BigInt(l.revenue), deposits: null,
        bond: BigInt(l.bond), forSale: number(l.forSale), sold: number(l.sold), salePrice: BigInt(l.price) },
    };
  }
  async positions(address: string) {
    return (await Promise.all((await this.source.catalog()).map(async record => {
      const [stake, pending] = await Promise.all([this.contract.read('stakes', [record.assetId, ss58ToH160(address)]), this.contract.read('pending', [record.assetId, ss58ToH160(address)])]);
      return { id: record.assetId, staked: number(stake.amount), pending: BigInt(pending) };
    }))).filter(position => position.staked > 0 || position.pending > 0n);
  }
  async rules() {
    const token = String(await this.contract.read('paymentToken')).toLowerCase();
    if (token !== this.pusdToken.toLowerCase()) throw new Error('Core payment asset does not match deployment configuration.');
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
    const tx = this.api.tx.utility.batchAll([
      this.api.tx.nfts.mint(this.deployment.deedsCollection, nftItem, operator.address, null),
      this.api.tx.nfts.setAttribute(this.deployment.deedsCollection, nftItem, { ItemOwner: null }, stringToHex('portion'), stringToHex(`core-v1:${input.docHash}`)),
      this.api.tx.nftFractionalization.fractionalize(this.deployment.deedsCollection, nftItem, assetId, operator.address, input.totalShares),
      this.approve(assetId, BigInt(input.sharesForSale)), this.approve(this.deployment.pusdAssetId, input.bond),
      this.callStep('create', [{ asset: assetId, totalShares: input.totalShares, forSale: input.sharesForSale, cadence: input.cadence,
        price: input.salePrice, minimum: input.minPerPeriod, bond: input.bond, docHash: input.docHash }]),
    ]);
    return { tx, assetId, nftItem, steps: [{ key: 'create', lane: 'native', pallet: 'Utility', method: 'batchAll', title: 'Create the native deed, shares and funding offer', detail: 'One atomic batch creates the NFT, fractionalizes it, escrows offered shares and the operator bond, and registers Core v1 terms.' }] };
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
