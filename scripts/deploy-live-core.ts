// Explicit, bounded Core v1 deployment. Default is read-only; --execute is required to submit.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { keccak256 } from 'ethers';
import {
  connect, TESTNET, PortionCoreArtifact, assetErc20Address, ss58ToH160, encodeInitCode, dryRunInstantiate,
  withMargin, submit, nativeFree, formatUnits, ReviveContract, type Deployment,
} from '@portion/sdk';
import { setup, root } from './lib';
const execute = process.argv.includes('--execute');
const publicAccount = JSON.parse(readFileSync(resolve(root, 'deployments/preflight.json'), 'utf8')).deployer as string;
const connected = execute ? await setup() : { api: await connect(TESTNET.ws), deployer: undefined };
const api = connected.api;
const deployer = connected.deployer;
const address = deployer?.address ?? publicAccount;
const U = 10n ** 14n;
const CAP = 425n * U;
const RESERVE = 70n * U;
const asset = 4217;
const file = resolve(root, 'deployments/core-checkpoint.json');
const d: Partial<Deployment> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const units = (value: bigint) => formatUnits(value, 14, 8).replaceAll(',', '');
const checkpoint = () => writeFileSync(file, JSON.stringify(d, null, 2) + '\n');
try {
  if (api.genesisHash.toHex() !== '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd' || api.runtimeVersion.specName.toString() !== 'portaldot-v3') throw new Error('Unexpected network.');
  if (d.deployer && d.deployer !== address) throw new Error('Checkpoint belongs to another signer.');
  const assetInfo: any = await api.query.assets.asset(asset);
  if (assetInfo.isSome) {
    const metadata: any = await api.query.assets.metadata(asset);
    if (assetInfo.unwrap().owner.toString() !== address || metadata.decimals.toNumber() !== 6 || metadata.symbol.toUtf8() !== 'pUSD') throw new Error('The payment asset ID is occupied by another owner or token.');
  }
  const code = encodeInitCode(PortionCoreArtifact.abi, PortionCoreArtifact.bytecode, [assetErc20Address(asset), ss58ToH160(address), 1]);
  const dry = await dryRunInstantiate(api, address, code);
  if (!dry.ok || dry.reverted || dry.deposit > CAP) throw new Error(`Constructor failed or exceeds the fixed 425 tPOT storage cap: ${dry.error ?? units(dry.deposit)}`);
  const weight = withMargin(dry).weight;
  const instantiate = api.tx.revive.instantiateWithCode(0n, weight, CAP, code, '0x', null);
  const fee = BigInt((await instantiate.paymentInfo(address)).partialFee.toString());
  const calls = [];
  if (assetInfo.isNone) calls.push(api.tx.utility.batchAll([api.tx.assets.create(asset, address, 1), api.tx.assets.setMetadata(asset, 'Portion Test Credit', 'pUSD', 6), api.tx.assets.mint(asset, address, 1_000_000n * 10n ** 6n)]));
  if (d.deedsCollection === undefined) calls.push(api.tx.nfts.create(address, { settings: 0, maxSupply: null, mintSettings: { mintType: { Public: null }, price: null, startBlock: null, endBlock: null, defaultItemSettings: 0 } }));
  const setupFees = (await Promise.all(calls.map(async tx => BigInt((await tx.paymentInfo(address)).partialFee.toString())))).reduce((sum, value) => sum + value, 0n);
  const setupDeposits = (assetInfo.isNone ? BigInt(api.consts.assets.assetDeposit.toString()) + BigInt(api.consts.assets.metadataDepositBase.toString()) + BigInt(api.consts.assets.metadataDepositPerByte.toString()) * 23n : 0n)
    + (d.deedsCollection === undefined ? BigInt(api.consts.nfts.collectionDeposit.toString()) : 0n);
  const account: any = await api.query.system.account(address);
  const free = BigInt(account.data.free.toString()); const frozen = BigInt(account.data.frozen.toString());
  const spendable = free > frozen ? free - frozen : 0n;
  const required = (d.portion ? 0n : CAP + fee) + setupFees + setupDeposits + RESERVE;
  const report = { checkedAt: new Date().toISOString(), kind: 'bounded-core-v1-deployment', account: address,
    runtimeBytes: PortionCoreArtifact.runtimeBytecode.length / 2 - 1, runtimeCodeHash: keccak256(PortionCoreArtifact.runtimeBytecode),
    constructorDryRunPassed: true, estimatedStorageTPOT: units(dry.deposit), hardStorageCapTPOT: units(CAP), minimumRemainingTPOT: units(RESERVE),
    freeTPOT: units(free), spendableTPOT: units(spendable), nonce: account.nonce.toString(), setupFeesTPOT: units(setupFees), setupDepositsTPOT: units(setupDeposits), deploymentFeeTPOT: units(fee), maximumBudgetIncludingReserveTPOT: units(required), funded: spendable >= required,
    note: 'Explicit hard storage cap, measured setup deposits/fees and 70 tPOT reserve replace the provisional percentage-based comparison. A cap rejection is not retried with a larger amount. Reserve is for operation and testing; users fund their own transactions. No automatic faucet distribution.' };
  writeFileSync(resolve(root, 'deployments/core-live-preflight.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!execute) { console.log('Read-only. Nothing signed or submitted.'); }
  else {
    if (!deployer || spendable < required) throw new Error('Bounded deployment budget is not funded. Nothing submitted.');
    Object.assign(d, { contractVersion: 'core-v1', network: TESTNET.id, chainId: TESTNET.chainId, deployer: address, treasury: address, pusdAssetId: asset });
    let remainingSetupDeposits = setupDeposits;
    for (const tx of calls) {
      const info = await tx.paymentInfo(address);
      const freeNow = await nativeFree(api, address);
      if (freeNow < RESERVE + CAP + fee + BigInt(info.partialFee.toString()) + remainingSetupDeposits) throw new Error('Reserve check failed before setup.');
      const out = await submit(api, tx, deployer);
      if (!out.ok) throw new Error(out.error);
      const event: any = out.events.find(record => api.events.nfts.Created.is(record.event));
      if (event) { d.deedsCollection = Number(event.event.data[0].toString()); remainingSetupDeposits -= BigInt(api.consts.nfts.collectionDeposit.toString()); }
      else { remainingSetupDeposits = d.deedsCollection === undefined ? BigInt(api.consts.nfts.collectionDeposit.toString()) : 0n; }
      d.txs = { ...d.txs, [event ? 'deeds' : 'pusd']: out.txHash }; checkpoint();
      console.log(`Setup finalized: ${out.txHash}`);
    }
    if (!d.portion) {
      if (await nativeFree(api, address) < RESERVE + CAP + fee) throw new Error('Reserve check failed before contract deployment.');
      const out = await submit(api, instantiate, deployer);
      if (!out.ok) throw new Error(out.error);
      const event: any = out.events.find(record => api.events.revive.Instantiated.is(record.event));
      if (!event) throw new Error('Instantiation receipt missing; do not retry blindly.');
      d.portion = event.event.data.contract.toHex();
      d.deployedBlock = out.blockNumber ?? (await api.rpc.chain.getHeader(out.blockHash)).number.toNumber();
      d.deployedAt = new Date().toISOString(); d.txs = { ...d.txs, portion: out.txHash }; checkpoint();
      console.log(`Contract finalized: ${out.txHash}`);
    }
    const response = await fetch(TESTNET.evmRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [d.portion, 'latest'] }) });
    const actual = await response.json() as { result?: string };
    if (!actual.result || keccak256(actual.result) !== report.runtimeCodeHash) throw new Error('Deployed bytecode differs from the reviewed artifact.');
    const contract = new ReviveContract(api, d.portion!, PortionCoreArtifact.abi);
    if (String(await contract.read('paymentToken')).toLowerCase() !== assetErc20Address(asset).toLowerCase()) throw new Error('Payment asset verification failed.');
    d.runtimeCodeHash = report.runtimeCodeHash;
    writeFileSync(resolve(root, 'deployments/portaldot-testnet.json'), JSON.stringify(d, null, 2) + '\n');
    const remaining = await nativeFree(api, address);
    if (remaining < RESERVE) throw new Error('Remaining free balance below reserve; stop all spending.');
    console.log(JSON.stringify({ deployed: true, contract: d.portion, deploymentBlock: d.deployedBlock, remainingTPOT: units(remaining), runtimeCodeHash: d.runtimeCodeHash }));
  }
} finally { await api.disconnect(); }
