import type { ApiPromise } from '@polkadot/api';
import type { SubmittableExtrinsic } from '@polkadot/api/types';
import { Interface, type InterfaceAbi } from 'ethers';
import { VIEW_ORIGIN } from './constants';

export interface Weight {
  refTime: bigint;
  proofSize: bigint;
}

export interface DryRun {
  ok: boolean;
  reverted: boolean;
  data: string;
  weight: Weight;
  /** Storage deposit the caller must be able to lock (refundable when storage is freed). */
  deposit: bigint;
  error?: string;
}

export interface Limits {
  weight: Weight;
  deposit: bigint;
}

/** Used when a dry run is impossible because it depends on earlier calls in the same atomic batch. */
export const FALLBACK_LIMITS: Limits = {
  weight: { refTime: 30_000_000_000n, proofSize: 3_000_000n },
  deposit: 200n * 10n ** 14n,
};

const big = (x: unknown): bigint => (x === undefined || x === null ? 0n : BigInt(x as string | number));
const pick = (o: any, ...keys: string[]) => {
  for (const k of keys) if (o && o[k] !== undefined) return o[k];
  return undefined;
};

function describeDispatchError(api: ApiPromise, err: any): string {
  const m = pick(err, 'module');
  if (m) {
    try {
      const meta = api.registry.findMetaError({ index: api.createType('u8', m.index), error: api.createType('[u8;4]', m.error) });
      return `${meta.section}.${meta.name}`;
    } catch {
      /* fall through */
    }
  }
  return typeof err === 'string' ? err : JSON.stringify(err);
}

function parseResult(api: ApiPromise, r: any, isInstantiate = false): DryRun {
  const res = r.result;
  const okBranch = pick(res, 'ok', 'Ok');
  const errBranch = pick(res, 'err', 'Err');
  const dep = r.storageDeposit ?? {};
  const charge = pick(dep, 'charge', 'Charge');
  const weight = r.weightRequired ?? r.gasRequired ?? { refTime: 0, proofSize: 0 };
  const base = {
    weight: { refTime: big(weight.refTime), proofSize: big(weight.proofSize) },
    deposit: big(charge),
  };
  if (errBranch !== undefined) return { ...base, ok: false, reverted: false, data: '0x', error: describeDispatchError(api, errBranch) };
  const inner = isInstantiate ? pick(okBranch, 'result') ?? okBranch : okBranch;
  const flags = pick(inner, 'flags');
  const bits = Number(typeof flags === 'object' && flags !== null ? flags.bits : flags ?? 0);
  return { ...base, ok: true, reverted: (bits & 1) === 1, data: (pick(inner, 'data') as string) ?? '0x' };
}

export async function dryRunCall(api: ApiPromise, origin: string, dest: string, data: string, value = 0n): Promise<DryRun> {
  const r = (await (api.call as any).reviveApi.call(origin, dest, value, null, null, data)).toJSON();
  return parseResult(api, r);
}

export async function dryRunInstantiate(api: ApiPromise, origin: string, code: string, value = 0n): Promise<DryRun & { address?: string }> {
  const r = (await (api.call as any).reviveApi.instantiate(origin, value, null, null, { Upload: code }, '0x', null)).toJSON();
  const out = parseResult(api, r, true);
  const okBranch = pick(r.result, 'ok', 'Ok');
  return { ...out, address: okBranch ? (pick(okBranch, 'addr') as string | undefined) : undefined };
}

export class ContractError extends Error {
  constructor(
    message: string,
    readonly data?: string,
  ) {
    super(message);
    this.name = 'ContractError';
  }
}

/** Turns revert data into a readable message using the contract's own custom errors. */
export function explainRevert(iface: Interface, data: string): string {
  if (!data || data === '0x') return 'reverted without a reason';
  try {
    const parsed = iface.parseError(data);
    if (parsed) return parsed.args.length ? `${parsed.name}(${parsed.args.map(String).join(', ')})` : parsed.name;
  } catch {
    /* not one of ours */
  }
  if (data.startsWith('0x08c379a0')) {
    try {
      return Interface.from(['error Error(string)']).parseError(data)?.args[0] ?? 'reverted';
    } catch {
      /* ignore */
    }
  }
  return `reverted (${data.slice(0, 10)})`;
}

export function withMargin(d: DryRun): Limits {
  return {
    weight: { refTime: (d.weight.refTime * 13n) / 10n + 1_000_000n, proofSize: (d.weight.proofSize * 13n) / 10n + 10_000n },
    deposit: (d.deposit * 125n) / 100n + 10n ** 14n,
  };
}

export class ReviveContract {
  readonly iface: Interface;
  constructor(
    readonly api: ApiPromise,
    readonly address: string,
    abi: InterfaceAbi,
  ) {
    this.iface = new Interface(abi);
  }

  encode(fn: string, args: unknown[] = []): string {
    return this.iface.encodeFunctionData(fn, args);
  }

  /** Read-only call through the `reviveApi` runtime API. Needs no balance and sends no transaction. */
  async read(fn: string, args: unknown[] = [], origin = VIEW_ORIGIN): Promise<any> {
    const r = await dryRunCall(this.api, origin, this.address, this.encode(fn, args));
    if (!r.ok) throw new ContractError(`${fn}: ${r.error}`);
    if (r.reverted) throw new ContractError(`${fn}: ${explainRevert(this.iface, r.data)}`, r.data);
    const out = this.iface.decodeFunctionResult(fn, r.data);
    return out.length === 1 ? out[0] : out;
  }

  /**
   * Builds a `revive.call` extrinsic. With an `origin` it first dry-runs the call to size the weight and storage
   * deposit limits and to surface a readable revert reason *before* anything is signed.
   */
  async buildCall(
    fn: string,
    args: unknown[],
    opts: { origin?: string; value?: bigint; limits?: Limits } = {},
  ): Promise<{ tx: SubmittableExtrinsic<'promise'>; data: string; limits: Limits; dry?: DryRun }> {
    const data = this.encode(fn, args);
    let limits = opts.limits;
    let dry: DryRun | undefined;
    if (!limits && opts.origin) {
      dry = await dryRunCall(this.api, opts.origin, this.address, data, opts.value ?? 0n);
      if (!dry.ok) throw new ContractError(`${fn}: ${dry.error}`);
      if (dry.reverted) throw new ContractError(`${fn}: ${explainRevert(this.iface, dry.data)}`, dry.data);
      limits = withMargin(dry);
    }
    limits ??= FALLBACK_LIMITS;
    const tx = this.api.tx.revive.call(this.address, opts.value ?? 0n, limits.weight, limits.deposit, data);
    return { tx, data, limits, dry };
  }
}

export interface DeployResult {
  address: string;
  blockHash: string;
  txHash: string;
}

export function encodeInitCode(abi: InterfaceAbi, bytecode: string, args: unknown[] = []): string {
  const iface = new Interface(abi);
  return bytecode + iface.encodeDeploy(args).slice(2);
}
