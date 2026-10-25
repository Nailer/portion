import type { Deployment, ListingView, Passport, PlanStep, PositionView } from '@portion/sdk';

export interface Rules {
  saleFeeBps: number;
  revenueFeeBps: number;
  minBondBps: number;
  slashTipBps: number;
  minCadence: number;
}

export interface Balances {
  pot: bigint;
  pusd: bigint | null;
}

export type StageName = 'preparing' | 'signing' | 'broadcast' | 'inBlock' | 'done' | 'failed';

export interface ActionResult {
  ok: boolean;
  unconfirmed?: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
  warning?: string;
  /** extra transactions that were part of the action (for example document storage) */
  txs?: { label: string; hash: string; block?: number }[];
  listingId?: number;
}

export interface Prepared {
  title: string;
  steps: PlanStep[];
  /** One honest sentence about what the user pays or locks. */
  cost?: string;
  run(onStage: (s: StageName, detail?: string, stepIndex?: number) => void): Promise<ActionResult>;
}

export interface TokenizeForm {
  name: string;
  summary: string;
  category: number;
  totalShares: number;
  sharesForSale: number;
  pricePusd: string;
  cadenceSeconds: number;
  minPerPeriodPusd: string;
  bondPusd: string;
  terms: string;
  image: { bytes: Uint8Array; mime: string } | null;
}

export type Intent =
  | { kind: 'buy'; id: number; shares: number }
  | { kind: 'claim'; ids: number[] }
  | { kind: 'deposit'; id: number; amount: bigint }
  | { kind: 'stake'; id: number; amount: number }
  | { kind: 'unstake'; id: number; amount: number }
  | { kind: 'slash'; id: number }
  | { kind: 'topUp'; id: number; amount: bigint }
  | { kind: 'operator'; fn: 'closeSale' | 'windDown' | 'withdrawBond'; id: number }
  | { kind: 'dexBuy'; id: number; pusdIn: bigint }
  | { kind: 'dexSell'; id: number; sharesIn: number }
  | { kind: 'dexSeed'; id: number; shares: number; pusd: bigint }
  | { kind: 'tokenize'; form: TokenizeForm };

export interface PoolView {
  shares: bigint;
  pusd: bigint;
  /** pUSD units per share */
  price: bigint;
}

export interface ProofView {
  deedLocked: boolean;
  deedOwner?: string;
  fractionalized: boolean;
  fractions?: string;
  assetMatches: boolean;
  supplyMatches: boolean;
  supply?: string;
  adminIsPallet: boolean;
  rolesControlled: boolean;
  finalizedHash: string;
  verified: boolean;
  notes: string[];
}

export interface DocMeta {
  hash: string;
  block: number;
  index: number;
  size: number;
  expiresAtBlock: number;
  blocksLeft: number;

}

export interface ActivityRow {
  id: number | string;
  block: number;
  ts: number;
  kind: string;
  listingId: number | null;
  actor: string | null;
  data: Record<string, any>;
}

export interface DripResult {
  ss58: string;
  h160: string;
  viaEvm: boolean;
  tx: string;
  block?: number;
  pot: string;
  pusd: string;
}

export interface Backend {
  mode: 'live';
  chainLabel: string;
  deployed: boolean;
  deployment?: Deployment;
  listings(): Promise<ListingView[]>;
  listing(id: number): Promise<ListingView>;
  positions(address: string): Promise<PositionView[]>;
  balances(address: string): Promise<Balances>;
  shareBalance(assetId: number, address: string): Promise<bigint>;
  rules(): Promise<Rules>;
  pool(listing: ListingView): Promise<PoolView | null>;
  quote(listing: ListingView, side: 'buy' | 'sell', amountIn: bigint): Promise<bigint | null>;
  prepare(intent: Intent, who: Passport): Promise<Prepared>;
  docUrl(hash: string): string;
  docMeta(hash: string): Promise<DocMeta | null>;
  docJson(hash: string): Promise<any | null>;
  proof(id: number): Promise<ProofView | null>;
  activity(q: { listing?: number; actor?: string; limit?: number }): Promise<ActivityRow[]>;
  revenue(id: number): Promise<{ ts: number; amount: bigint; kind: 'revenue' | 'slash' }[]>;
  drip(address: string): Promise<DripResult>;
  head(): Promise<number>;
  /** Local wall-clock time in seconds; not a finalized chain timestamp. */
  now(): number;
}

/** A failure the user can fix, shown as guidance instead of a stack trace. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly fix?: 'faucet',
  ) {
    super(message);
  }
}

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      /* not json */
    }
    throw new UserError(msg);
  }
  if (!res.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new UserError('The service did not return API data. This feature is unavailable until its backend is reachable.');
  }
  return res.json() as Promise<T>;
}
