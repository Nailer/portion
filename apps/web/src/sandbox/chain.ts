// A private, in-browser chain for the sandbox. It runs the compiled Core v2 bytecode from the SDK, unchanged, in an
// EVM inside this tab. Payment and share tokens are SandboxToken stand-ins placed at the same precompile addresses
// Portaldot uses for native assets. Nothing here touches Portaldot, a wallet or a key.
//
// State is a list of operations. Saving the list and replaying it on load rebuilds the exact same chain, so a page
// refresh keeps the sandbox where the visitor left it.
import { createEVM, type EVM } from '@ethereumjs/evm';
import { Common, Hardfork, Mainnet } from '@ethereumjs/common';
import { Address, createAddressFromString, hexToBytes, bytesToHex } from '@ethereumjs/util';
import { AbiCoder, Interface, keccak256, toUtf8Bytes, type LogDescription } from 'ethers';
import { PortionCoreV2Artifact } from '@portion/sdk/abi';
import { assetErc20Address } from '@portion/sdk/addresses';
import TokenArtifact from './SandboxToken.json';

export const SANDBOX_PUSD_ID = 1984;
const GAS = 30_000_000n;
const ZERO = new Uint8Array(32);
export const core = new Interface(PortionCoreV2Artifact.abi);
export const token = new Interface(TokenArtifact.abi);

/** A deterministic sandbox address for a label, so personas keep their addresses across visits. */
export const labelAddress = (label: string) => `0x${keccak256(toUtf8Bytes(`portion-sandbox:${label}`)).slice(-40)}`;
export const TREASURY = labelAddress('treasury');
export const DEPLOYER = labelAddress('deployer');

export type Op =
  /** A Core call. `approve` first lets the contract pull those token amounts, in one all-or-nothing step. */
  | { op: 'call'; from: string; fn: string; args: unknown[]; approve?: { asset: number; amount: string }[] }
  | { op: 'mint'; asset: number; to: string; amount: string }
  | { op: 'asset'; asset: number }
  | { op: 'skip'; seconds: number };

export interface SandboxEvent {
  id: string;
  block: number;
  ts: number;
  txHash: string;
  from: string;
  name: string;
  args: Record<string, unknown>;
}

export interface CallOutcome { ok: boolean; txHash: string; block: number; error?: string }

// Plain words for the contract's few custom errors. The contract name of the error is always shown too.
const ERRORS: Record<string, string> = {
  Unauthorized: 'This role is not allowed to do that. Switch to the role that can, such as the operator, the named reviewer or a holder with staked shares.',
  Invalid: 'The contract refused these values or this step at this point in the listing’s life.',
  Protected: 'The contract refused this to protect holders.',
  Closed: 'This listing is closed for that action.',
  Empty: 'There is nothing to take.',
  Paused: 'The guardian has paused new money. Claims, refunds, deposits and challenges still work.',
  Reentrancy: 'The contract blocked a nested call.',
};

/** Serialises bigint arguments for the saved operation list. */
const encodeArg = (value: unknown): unknown =>
  typeof value === 'bigint' ? { $n: value.toString() } : Array.isArray(value) ? value.map(encodeArg)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeArg(v)])) : value;
const decodeArg = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(decodeArg)
    : value && typeof value === 'object' ? ('$n' in value ? BigInt((value as { $n: string }).$n) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeArg(v)]))) : value;
export const saveOps = (ops: Op[]) => JSON.stringify(ops.map(op => op.op === 'call' ? { ...op, args: encodeArg(op.args) } : op));
export const loadOps = (text: string): Op[] => (JSON.parse(text) as Op[]).map(op => op.op === 'call' ? { ...op, args: decodeArg(op.args) as unknown[] } : op);

/** Turns any value from an ethers Result into plain JSON-safe data for activity rows. */
const plain = (value: unknown): unknown => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(plain) : value;

function explain(data: Uint8Array): string {
  const hex = bytesToHex(data);
  if (hex.length < 10) return 'The contract refused this action.';
  try {
    const parsed = core.parseError(hex);
    if (parsed) return `${ERRORS[parsed.name] ?? 'The contract refused this action.'} (contract error: ${parsed.name})`;
  } catch { /* not a Core error */ }
  if (hex.startsWith('0x08c379a0')) {
    const [reason] = AbiCoder.defaultAbiCoder().decode(['string'], `0x${hex.slice(10)}`);
    if (reason === 'balance') return 'This account does not hold enough of that token. Use “Add test pUSD” in the sandbox bar.';
    if (reason === 'allowance') return 'The contract was not allowed to move that token.';
    return `The token refused: ${reason}`;
  }
  if (hex.startsWith('0x90b8ec18')) return 'A token transfer failed. The account may not hold enough pUSD or shares.';
  return 'The contract refused this action.';
}

export class SandboxChain {
  readonly ops: Op[] = [];
  readonly events: SandboxEvent[] = [];
  block = 0;
  now: number;
  portion = '';
  private constructor(private evm: EVM, readonly genesis: number) { this.now = genesis; }

  static async create(genesis: number, ops: Op[] = [], guardian: string): Promise<SandboxChain> {
    const evm = await createEVM({ common: new Common({ chain: Mainnet, hardfork: Hardfork.Shanghai }) });
    const chain = new SandboxChain(evm, genesis);
    await chain.install(SANDBOX_PUSD_ID);
    const args = core.encodeDeploy([assetErc20Address(SANDBOX_PUSD_ID), TREASURY, guardian, 1]).slice(2);
    const created = await evm.runCall({ caller: createAddressFromString(DEPLOYER), data: hexToBytes(`${PortionCoreV2Artifact.bytecode}${args}` as `0x${string}`), gasLimit: GAS, block: chain.header() });
    if (created.execResult.exceptionError || !created.createdAddress) throw new Error('The sandbox could not start the Core v2 contract.');
    chain.portion = created.createdAddress.toString();
    // The deployed code must be the reviewed artifact, exactly as the live app checks it.
    const deployed = await evm.stateManager.getCode(created.createdAddress);
    if (bytesToHex(deployed) !== PortionCoreV2Artifact.runtimeBytecode.toLowerCase()) throw new Error('Sandbox runtime code differs from the Core v2 artifact.');
    for (const op of ops) {
      const result = await chain.apply(op);
      if (!result.ok) throw new Error(`Saved sandbox step ${op.op} could not be replayed: ${result.error}`);
    }
    return chain;
  }

  private header(): any {
    return { header: { number: BigInt(this.block), coinbase: new Address(new Uint8Array(20)), timestamp: BigInt(this.now), difficulty: 0n,
      prevRandao: ZERO, gasLimit: GAS, baseFeePerGas: 0n, getBlobGasPrice: () => undefined } };
  }

  private txHash() { return keccak256(toUtf8Bytes(`portion-sandbox-tx:${this.genesis}:${this.ops.length}`)); }

  /** Places the stand-in token code at a native asset's precompile address. */
  private async install(asset: number) {
    await this.evm.stateManager.putCode(createAddressFromString(assetErc20Address(asset)), hexToBytes(TokenArtifact.runtimeBytecode as `0x${string}`));
  }

  private async run(from: string, to: string, data: string): Promise<{ ok: boolean; error?: string; logs: any[]; returned: Uint8Array }> {
    const result = await this.evm.runCall({ caller: createAddressFromString(from), to: createAddressFromString(to), data: hexToBytes(data as `0x${string}`), gasLimit: GAS, block: this.header(), skipBalance: true });
    const failed = result.execResult.exceptionError;
    return { ok: !failed, error: failed ? explain(result.execResult.returnValue) : undefined, logs: result.execResult.logs ?? [], returned: result.execResult.returnValue };
  }

  /** Applies one operation, records it if it succeeds, and collects Core events. A failed call changes nothing. */
  async apply(op: Op): Promise<CallOutcome> {
    const txHash = this.txHash();
    let outcome: { ok: boolean; error?: string; logs: any[] } = { ok: true, logs: [] };
    let from = DEPLOYER;
    if (op.op === 'skip') {
      if (!Number.isSafeInteger(op.seconds) || op.seconds <= 0) return { ok: false, txHash, block: this.block, error: 'Skip forward by a positive number of seconds.' };
      this.now += op.seconds;
    } else if (op.op === 'asset') await this.install(op.asset);
    else if (op.op === 'mint') outcome = await this.run(DEPLOYER, assetErc20Address(op.asset), token.encodeFunctionData('mint', [op.to, BigInt(op.amount)]));
    else {
      from = op.from;
      await this.evm.stateManager.checkpoint();
      for (const allowance of op.approve ?? []) if (outcome.ok) outcome = await this.run(op.from, assetErc20Address(allowance.asset), token.encodeFunctionData('approve', [this.portion, BigInt(allowance.amount)]));
      if (outcome.ok) outcome = await this.run(op.from, this.portion, core.encodeFunctionData(op.fn, op.args));
      // The approval is undone with a refused call, so nothing is left behind.
      if (outcome.ok) await this.evm.stateManager.commit(); else await this.evm.stateManager.revert();
    }
    if (!outcome.ok) return { ok: false, txHash, block: this.block, error: outcome.error };
    if (op.op !== 'skip') this.block += 1;
    this.ops.push(op);
    outcome.logs.forEach(([address, topics, data]: [Uint8Array, Uint8Array[], Uint8Array], index: number) => {
      if (bytesToHex(address) !== this.portion.toLowerCase()) return;
      let parsed: LogDescription | null = null;
      try { parsed = core.parseLog({ topics: topics.map(t => bytesToHex(t)), data: bytesToHex(data) }); } catch { return; }
      if (!parsed) return;
      const args = Object.fromEntries(parsed.fragment.inputs.map((input, i) => [input.name, plain(parsed!.args[i])]));
      this.events.push({ id: `${this.block}-${index}`, block: this.block, ts: this.now, txHash, from: from.toLowerCase(), name: parsed.name, args });
    });
    return { ok: true, txHash, block: this.block };
  }

  /** Tries operations without keeping them, so a refusal can be shown before the visitor confirms. */
  simulate(ops: Op[]): Promise<CallOutcome> { return this.batch(ops, false); }

  /** Applies several operations as one: if any fails, every earlier one in the batch is undone. */
  async batch(ops: Op[], keep = true): Promise<CallOutcome> {
    const mark = { ops: this.ops.length, events: this.events.length, block: this.block, now: this.now };
    await this.evm.stateManager.checkpoint();
    let last: CallOutcome = { ok: true, txHash: this.txHash(), block: this.block };
    for (const op of ops) {
      last = await this.apply(op);
      if (!last.ok) break;
    }
    if (last.ok && keep) { await this.evm.stateManager.commit(); return last; }
    await this.evm.stateManager.revert();
    this.ops.length = mark.ops; this.events.length = mark.events; this.block = mark.block; this.now = mark.now;
    return last;
  }

  /** Reads a Core view at the current sandbox time. */
  async read(fn: string, args: unknown[] = []): Promise<any> {
    const out = await this.run(DEPLOYER, this.portion, core.encodeFunctionData(fn, args));
    if (!out.ok) throw new Error(out.error);
    const result = core.decodeFunctionResult(fn, bytesToHex(out.returned));
    return result.length === 1 ? result[0] : result;
  }

  async tokenBalance(asset: number, who: string): Promise<bigint> {
    const out = await this.run(DEPLOYER, assetErc20Address(asset), token.encodeFunctionData('balanceOf', [who]));
    return out.ok && out.returned.length ? BigInt(bytesToHex(out.returned)) : 0n;
  }
}
