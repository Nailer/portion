import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import { stringToHex } from '@polkadot/util';
import { encodeBytes32String } from 'ethers';
import { PortionArtifact } from './abi';
import { ASSET_PRECOMPILE_PREFIX, PUSD_DECIMALS } from './constants';
import { assetErc20Address, h160ToFallbackSs58, ss58ToH160 } from './addresses';
import { assetBalance, assetExists } from './chain';
import { FALLBACK_LIMITS, ReviveContract } from './revive';
import type { Passport } from './passport';

export interface Deployment {
  network: string;
  chainId: number;
  portion: string; // H160
  pusdAssetId: number;
  deedsCollection: number;
  treasury: string; // SS58
  deployer: string; // SS58
  teleport?: string;
  bnb?: { chainId: number; teleport: string; wpusd: string };
  deployedAt?: string;
  txs?: Record<string, string>;
}

export const HEALTH = ['Healthy', 'Late', 'Defaulted', 'WoundDown'] as const;
export type HealthName = (typeof HEALTH)[number];

export interface VaultView {
  totalStaked: bigint;
  accPerShare: bigint;
  totalRevenue: bigint;
  deposits: number;
  bond: bigint;
  forSale: number;
  sold: number;
  salePrice: bigint;
}

export interface ListingView {
  id: number;
  operator: string; // H160
  payToken: string;
  assetId: number;
  nftCollection: number;
  nftItem: number;
  category: number;
  strikes: number;
  totalShares: number;
  cadence: number;
  createdAt: number;
  lastDepositAt: number;
  closedAt: number;
  saleOpen: boolean;
  docHash: string;
  coverHash: string;
  minPerPeriod: bigint;
  name: string;
  summary: string;
  vault: VaultView;
  health: HealthName;
  shareToken: string;
}

export interface PositionView {
  id: number;
  staked: number;
  pending: bigint;
}

/** One line of the "Under the hood" panel: what the batch does, in which module. */
export interface PlanStep {
  key: string;
  lane: 'native' | 'evm' | 'storage';
  pallet: string;
  method: string;
  title: string;
  detail: string;
}

export interface Plan {
  tx: SubmittableExtrinsic<'promise'>;
  steps: PlanStep[];
}

export interface TokenizeInput {
  name: string;
  summary: string;
  category: number;
  totalShares: number;
  sharesForSale: number;
  salePrice: bigint; // pUSD units per share
  cadence: number; // seconds
  minPerPeriod: bigint;
  bond: bigint;
  docHash: string;
  coverHash: string;
}

const n = (x: any) => Number(x);
const b = (x: any) => BigInt(x);

function toListing(l: any, v: any, h: any, id: number, shareToken: string): ListingView {
  return {
    id,
    operator: String(l.operator).toLowerCase(),
    payToken: String(l.payToken).toLowerCase(),
    assetId: n(l.assetId),
    nftCollection: n(l.nftCollection),
    nftItem: n(l.nftItem),
    category: n(l.category),
    strikes: n(l.strikes),
    totalShares: n(l.totalShares),
    cadence: n(l.cadence),
    createdAt: n(l.createdAt),
    lastDepositAt: n(l.lastDepositAt),
    closedAt: n(l.closedAt),
    saleOpen: Boolean(l.saleOpen),
    docHash: String(l.docHash),
    coverHash: String(l.coverHash),
    minPerPeriod: b(l.minPerPeriod),
    name: String(l.name),
    summary: String(l.summary),
    health: HEALTH[n(h)],
    shareToken,
    vault: {
      totalStaked: b(v.totalStaked),
      accPerShare: b(v.accPerShare),
      totalRevenue: b(v.totalRevenue),
      deposits: n(v.deposits),
      bond: b(v.bond),
      forSale: n(v.forSale),
      sold: n(v.sold),
      salePrice: b(v.salePrice),
    },
  };
}

export class PortionClient {
  readonly contract: ReviveContract;
  readonly contractAccount: string;
  readonly pusdToken: string;

  constructor(
    readonly api: ApiPromise,
    readonly deployment: Deployment,
  ) {
    this.contract = new ReviveContract(api, deployment.portion, PortionArtifact.abi);
    this.contractAccount = h160ToFallbackSs58(deployment.portion);
    this.pusdToken = assetErc20Address(deployment.pusdAssetId, ASSET_PRECOMPILE_PREFIX);
  }

  // ───────────── reads ─────────────

  async count(): Promise<number> {
    return Number(await this.contract.read('listingCount'));
  }

  async listings(): Promise<ListingView[]> {
    const total = await this.count();
    const out: ListingView[] = [];
    for (let offset = 0; offset < total; offset += 25) {
      const [ls, vs, hs] = await this.contract.read('getListings', [offset, 25]);
      ls.forEach((l: any, i: number) => {
        const id = offset + i;
        out.push(toListing(l, vs[i], hs[i], id, assetErc20Address(n(l.assetId))));
      });
    }
    return out;
  }

  async listing(id: number): Promise<ListingView> {
    const [l, v, h] = await this.contract.read('getListing', [id]);
    return toListing(l, v, h, id, assetErc20Address(n(l.assetId)));
  }

  async positions(ss58: string): Promise<PositionView[]> {
    const rows = await this.contract.read('positionsOf', [ss58ToH160(ss58), 0, 200]);
    return rows.map((r: any) => ({ id: n(r.id), staked: n(r.staked), pending: b(r.pending) }));
  }

  async pending(id: number, ss58: string): Promise<bigint> {
    return b(await this.contract.read('pending', [id, ss58ToH160(ss58)]));
  }

  async shareBalance(assetId: number, ss58: string): Promise<bigint> {
    return assetBalance(this.api, assetId, ss58);
  }

  pusdBalance(ss58: string): Promise<bigint> {
    return assetBalance(this.api, this.deployment.pusdAssetId, ss58);
  }

  async rules() {
    const [saleFeeBps, revenueFeeBps, minBondBps, slashTipBps, minCadence] = await Promise.all(
      ['saleFeeBps', 'revenueFeeBps', 'minBondBps', 'slashTipBps', 'minCadence'].map((f) => this.contract.read(f)),
    );
    return { saleFeeBps: n(saleFeeBps), revenueFeeBps: n(revenueFeeBps), minBondBps: n(minBondBps), slashTipBps: n(slashTipBps), minCadence: n(minCadence) };
  }

  // ───────────── builders ─────────────

  private approve(assetId: number, amount: bigint) {
    return this.api.tx.assets.approveTransfer(assetId, this.contractAccount, amount);
  }

  private callStep(fn: string, args: unknown[]) {
    const data = this.contract.encode(fn, args);
    return this.api.tx.revive.call(this.deployment.portion, 0n, FALLBACK_LIMITS.weight, FALLBACK_LIMITS.deposit, data);
  }

  /** Picks a native asset id that is free both in `pallet-assets` and in the Portion registry. */
  async freeAssetId(): Promise<number> {
    for (let i = 0; i < 25; i++) {
      const id = 100_000 + Math.floor(Math.random() * 900_000);
      if (!(await assetExists(this.api, id))) {
        const [found] = await this.contract.read('idOfAsset', [id]);
        if (!found) return id;
      }
    }
    throw new Error('could not find a free asset id');
  }

  async freeNftItem(): Promise<number> {
    for (let i = 0; i < 25; i++) {
      const id = Math.floor(Math.random() * 4_000_000_000);
      if (((await this.api.query.nfts.item(this.deployment.deedsCollection, id)) as any).isNone) return id;
    }
    throw new Error('could not find a free NFT item id');
  }

  /**
   * The headline transaction. One signature, one atomic extrinsic, six calls across four modules:
   * mint the deed NFT → pin its terms → fractionalise it into shares → approve the registry for shares and bond →
   * register the listing in Solidity. If any step fails, none of them happened.
   * (Documents are stored beforehand as their own transactions; see storage.ts for why.)
   */
  async planTokenize(operator: Passport, input: TokenizeInput): Promise<Plan & { assetId: number; nftItem: number }> {
    const api = this.api;
    const d = this.deployment;
    const assetId = await this.freeAssetId();
    const nftItem = await this.freeNftItem();

    const params = {
      assetId,
      nftCollection: d.deedsCollection,
      nftItem,
      category: input.category,
      totalShares: input.totalShares,
      sharesForSale: input.sharesForSale,
      cadence: input.cadence,
      payToken: this.pusdToken,
      salePrice: input.salePrice,
      minPerPeriod: input.minPerPeriod,
      bond: input.bond,
      docHash: input.docHash,
      coverHash: input.coverHash,
      name: input.name,
      summary: input.summary,
    };

    const calls = [
      api.tx.nfts.mint(d.deedsCollection, nftItem, operator.address, null),
      api.tx.nfts.setAttribute(d.deedsCollection, nftItem, { ItemOwner: null }, stringToHex('portion'), stringToHex(`v1:${input.docHash}`)),
      api.tx.nftFractionalization.fractionalize(d.deedsCollection, nftItem, assetId, operator.address, input.totalShares),
      this.approve(assetId, BigInt(input.sharesForSale)),
      this.approve(d.pusdAssetId, input.bond),
      this.callStep('createListing', [params]),
    ];

    const steps: PlanStep[] = [
      { key: 'mint', lane: 'native', pallet: 'Nfts', method: 'mint', title: 'Mint the deed', detail: `A native NFT (#${nftItem}) in the shared Portion Deeds collection represents the asset itself.` },
      { key: 'meta', lane: 'native', pallet: 'Nfts', method: 'setAttribute', title: 'Pin the terms hash to the deed', detail: `The NFT carries the hash of the terms stored on-chain (${input.docHash.slice(0, 12)}…), written by you as the item owner.` },
      { key: 'frac', lane: 'native', pallet: 'NftFractionalization', method: 'fractionalize', title: `Split into ${input.totalShares.toLocaleString()} shares`, detail: `The pallet disables transfers of the deed and mints native asset #${assetId} with the pallet as its only administrator. Supply is fixed, and whoever re-collects 100% of shares can unify the deed back.` },
      { key: 'ap1', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Allow the registry to escrow shares for sale', detail: `Native approval, which Solidity sees as a normal ERC-20 allowance.` },
      { key: 'ap2', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Allow the registry to hold your bond', detail: 'The bond is paid in pUSD and is slashed to holders if revenue stops.' },
      { key: 'evm', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Register the listing in Solidity', detail: 'Portion.createListing(...) checks the share supply, pulls shares and bond, and opens the sale.' },
    ];

    return { tx: api.tx.utility.batchAll(calls), steps, assetId, nftItem };
  }

  planBuy(listing: ListingView, shares: number): Plan {
    const cost = BigInt(shares) * listing.vault.salePrice;
    return {
      tx: this.api.tx.utility.batchAll([this.approve(this.deployment.pusdAssetId, cost), this.callStep('buy', [listing.id, shares])]),
      steps: [
        { key: 'ap', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Approve payment', detail: 'Lets the registry pull exactly this amount of pUSD.' },
        { key: 'buy', lane: 'evm', pallet: 'Revive', method: 'call', title: `Buy ${shares} share${shares === 1 ? '' : 's'}`, detail: 'Portion.buy(): pays the operator, takes the 1% fee, and starts your shares earning immediately.' },
      ],
    };
  }

  planDeposit(listing: ListingView, amount: bigint, memo = 'revenue'): Plan {
    return {
      tx: this.api.tx.utility.batchAll([
        this.approve(this.deployment.pusdAssetId, amount),
        this.callStep('deposit', [listing.id, amount, encodeBytes32String(memo.slice(0, 31))]),
      ]),
      steps: [
        { key: 'ap', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Approve payment', detail: 'Lets the registry pull this deposit.' },
        { key: 'dep', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Deposit revenue', detail: 'Splits it across every staked share and resets the cadence clock.' },
      ],
    };
  }

  planTopUpBond(listing: ListingView, amount: bigint): Plan {
    return {
      tx: this.api.tx.utility.batchAll([this.approve(this.deployment.pusdAssetId, amount), this.callStep('topUpBond', [listing.id, amount])]),
      steps: [
        { key: 'ap', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Approve bond', detail: 'pUSD allowance for the registry.' },
        { key: 'bond', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Top up the bond', detail: 'Re-arms accountability after a slash.' },
      ],
    };
  }

  planStake(listing: ListingView, amount: number): Plan {
    return {
      tx: this.api.tx.utility.batchAll([this.approve(listing.assetId, BigInt(amount)), this.callStep('stake', [listing.id, amount])]),
      steps: [
        { key: 'ap', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Approve shares', detail: 'Native share asset → ERC-20 allowance.' },
        { key: 'stake', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Stake shares to earn', detail: 'Use this for shares bought on the native DEX.' },
      ],
    };
  }

  /** Claims every listing with pending revenue in one atomic transaction. */
  planClaim(ids: number[]): Plan {
    return {
      tx: this.api.tx.utility.batchAll(ids.map((id) => this.callStep('claim', [id]))),
      steps: ids.map((id) => ({ key: `c${id}`, lane: 'evm' as const, pallet: 'Revive', method: 'call', title: `Claim listing #${id}`, detail: 'Portion.claim() pays pending revenue in pUSD.' })),
    };
  }

  planUnstake(listing: ListingView, amount: number): Plan {
    return {
      tx: this.callStep('unstake', [listing.id, amount]),
      steps: [{ key: 'un', lane: 'evm', pallet: 'Revive', method: 'call', title: `Unstake ${amount} shares`, detail: 'Harvests pending revenue and returns the shares to your account.' }],
    };
  }

  planSlash(id: number): Plan {
    return {
      tx: this.callStep('slash', [id]),
      steps: [{ key: 'slash', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Slash the operator bond', detail: 'Distributes the bond to share-holders; the caller keeps a 1% tip.' }],
    };
  }

  planOperator(fn: 'closeSale' | 'windDown' | 'withdrawBond', id: number): Plan {
    const titles = { closeSale: 'Close the sale', windDown: 'Wind the listing down', withdrawBond: 'Withdraw the bond' } as const;
    return {
      tx: this.callStep(fn, [id]),
      steps: [{ key: fn, lane: 'evm', pallet: 'Revive', method: 'call', title: titles[fn], detail: `Portion.${fn}()` }],
    };
  }

  /** What `quote` means to a human: cost, fee, and what the operator receives. */
  quoteBuy(listing: ListingView, shares: number, saleFeeBps: number) {
    const cost = BigInt(shares) * listing.vault.salePrice;
    const fee = (cost * BigInt(saleFeeBps)) / 10_000n;
    return { cost, fee, toOperator: cost - fee, decimals: PUSD_DECIMALS };
  }
}
