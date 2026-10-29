// Explicit, bounded Core v2 candidate deployment. Default is read-only: it dry-runs the constructor on the live
// testnet, measures the storage deposit and checks the deployer's balance against the 40 tPOT operating floor.
// --execute is required to submit, and it refuses unless the measured budget is funded.
//
//   npx tsx scripts/deploy-core-v2.ts --guardian 0x…            # read-only cost check
//   npx tsx scripts/deploy-core-v2.ts --guardian 0x… --execute  # deploy (needs DEPLOYER_MNEMONIC)
//
// It writes deployments/core-v2-preflight.json, and on success deployments/portaldot-testnet-v2.json. It never
// edits deployments/portaldot-testnet.json: switching the app from v1 to v2 is a separate, reviewed step.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { keccak256 } from 'ethers';
import {
  connect, TESTNET, PortionCoreV2Artifact, assetErc20Address, ss58ToH160, encodeInitCode, dryRunInstantiate,
  withMargin, submit, nativeFree, formatUnits, ReviveContract, type Deployment,
} from '@portion/sdk';
import { setup, root } from './lib';

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const execute = process.argv.includes('--execute');
const guardian = arg('--guardian') ?? '0x0000000000000000000000000000000000000000';
if (!/^0x[0-9a-fA-F]{40}$/.test(guardian)) throw new Error('--guardian must be an H160 address. Use the zero address only if no pause is wanted.');

const U = 10n ** 14n; // 1 tPOT in plancks (14 decimals on Portaldot V3)
const RESERVE = 40n * U; // the approved operating floor (docs/OPERATING-BUDGET.md)
const v1: Deployment = JSON.parse(readFileSync(resolve(root, 'deployments/portaldot-testnet.json'), 'utf8'));
const publicAccount = v1.deployer;
const units = (value: bigint) => formatUnits(value, 14, 8).replaceAll(',', '');

const connected = execute ? await setup() : { api: await connect(TESTNET.ws), deployer: undefined };
const api = connected.api;
const address = connected.deployer?.address ?? publicAccount;
try {
  if (api.genesisHash.toHex() !== '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd' || api.runtimeVersion.specName.toString() !== 'portaldot-v3') throw new Error('Unexpected network.');
  if (connected.deployer && address !== publicAccount) throw new Error('The signer differs from the disclosed v1 deployer and treasury.');
  // Same payment asset and treasury as v1, so fees and test credits stay comparable.
  const args = [assetErc20Address(v1.pusdAssetId), ss58ToH160(v1.treasury), guardian, 1];
  const code = encodeInitCode(PortionCoreV2Artifact.abi, PortionCoreV2Artifact.bytecode, args);
  const dry = await dryRunInstantiate(api, address, code);
  const runtimeBytes = PortionCoreV2Artifact.runtimeBytecode.length / 2 - 1;
  if (!dry.ok && String(dry.error).includes('StorageDepositNotEnoughFunds')) {
    // The runtime refuses even a dry run when the caller cannot cover the deposit, so estimate it from the chain's
    // own per-byte rate. v1's measured deposit (401.5305 tPOT for 4,832 bytes) was 1.385× its code-only figure;
    // the range runs from the code-only figure to that same ratio applied to v2.
    const perByte = BigInt((api.consts.revive as any).depositPerByte.toString());
    const low = perByte * BigInt(runtimeBytes), high = low * 1385n / 1000n;
    const account: any = await api.query.system.account(address);
    const spendable = BigInt(account.data.free.toString()) - BigInt(account.data.frozen.toString());
    const report = { checkedAt: new Date().toISOString(), kind: 'bounded-core-v2-candidate-deployment', account: address, guardian, runtimeBytes,
      dryRun: 'refused by the runtime: StorageDepositNotEnoughFunds', depositPerByteTPOT: units(perByte),
      estimatedStorageDepositTPOT: { low: units(low), high: units(high) }, operatingFloorTPOT: units(RESERVE), spendableTPOT: units(spendable),
      shortfallTPOT: { low: units(low + RESERVE - spendable), high: units(high + RESERVE - spendable) }, funded: false,
      note: 'Estimate only: the chain refuses a constructor dry run the caller cannot pay for. Re-run once funded to measure the exact deposit.' };
    writeFileSync(resolve(root, 'deployments/core-v2-preflight.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    throw new Error('Not funded. Nothing signed or submitted.');
  }
  if (!dry.ok || dry.reverted) throw new Error(`Constructor dry run failed: ${dry.error ?? 'reverted'}. Nothing submitted.`);
  const limits = withMargin(dry);
  const instantiate = api.tx.revive.instantiateWithCode(0n, limits.weight, limits.deposit, code, '0x', null);
  const fee = BigInt((await instantiate.paymentInfo(address)).partialFee.toString());
  const account: any = await api.query.system.account(address);
  const free = BigInt(account.data.free.toString()), frozen = BigInt(account.data.frozen.toString());
  const spendable = free > frozen ? free - frozen : 0n;
  const required = limits.deposit + fee + RESERVE;
  const runtimeCodeHash = keccak256(PortionCoreV2Artifact.runtimeBytecode);
  const report = {
    checkedAt: new Date().toISOString(), kind: 'bounded-core-v2-candidate-deployment', account: address, guardian,
    runtimeBytes, runtimeCodeHash,
    measuredStorageDepositTPOT: units(dry.deposit), storageCapWithMarginTPOT: units(limits.deposit), deploymentFeeTPOT: units(fee),
    operatingFloorTPOT: units(RESERVE), spendableTPOT: units(spendable), requiredIncludingFloorTPOT: units(required),
    shortfallTPOT: spendable >= required ? '0' : units(required - spendable), funded: spendable >= required,
    note: 'Measured by a read-only constructor dry run against the live testnet. The storage deposit is refundable only if the contract is removed. The 40 tPOT floor is never spent.',
  };
  writeFileSync(resolve(root, 'deployments/core-v2-preflight.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!execute) console.log('Read-only. Nothing signed or submitted.');
  else {
    if (!connected.deployer || spendable < required) throw new Error(`Budget is not funded; short by ${report.shortfallTPOT} tPOT. Nothing submitted.`);
    if (await nativeFree(api, address) < required) throw new Error('Balance changed before submission. Nothing submitted.');
    const out = await submit(api, instantiate, connected.deployer);
    if (!out.ok) throw new Error(out.error);
    const event: any = out.events.find(record => api.events.revive.Instantiated.is(record.event));
    if (!event) throw new Error('Instantiation receipt missing; do not retry blindly.');
    const portion = event.event.data.contract.toHex();
    const response = await fetch(TESTNET.evmRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [portion, 'latest'] }) });
    const actual = await response.json() as { result?: string };
    if (!actual.result || keccak256(actual.result) !== runtimeCodeHash) throw new Error('Deployed bytecode differs from the reviewed artifact.');
    const contract = new ReviveContract(api, portion, PortionCoreV2Artifact.abi);
    if (String(await contract.read('paymentToken')).toLowerCase() !== assetErc20Address(v1.pusdAssetId).toLowerCase()) throw new Error('Payment asset verification failed.');
    if (String(await contract.read('guardian')).toLowerCase() !== guardian.toLowerCase()) throw new Error('Guardian verification failed.');
    const deployment: Deployment = { ...v1, contractVersion: 'core-v2', guardian, portion, runtimeCodeHash,
      deployedBlock: out.blockNumber ?? (await api.rpc.chain.getHeader(out.blockHash)).number.toNumber(), deployedAt: new Date().toISOString(), txs: { portion: out.txHash } };
    writeFileSync(resolve(root, 'deployments/portaldot-testnet-v2.json'), JSON.stringify(deployment, null, 2) + '\n');
    const remaining = await nativeFree(api, address);
    if (remaining < RESERVE) throw new Error('Remaining free balance is below the 40 tPOT floor; stop all spending.');
    console.log(JSON.stringify({ deployed: true, contract: portion, block: deployment.deployedBlock, remainingTPOT: units(remaining) }));
  }
} finally { await api.disconnect(); }
