// Read-only comparison. Never derives keys, signs, deploys, or changes the current SDK artifact.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import {
  connect, TESTNET, PortionArtifact, assetErc20Address, ss58ToH160,
  encodeInitCode, dryRunInstantiate, withMargin, formatUnits,
} from '@portion/sdk';
import { deploymentBudget } from './deployment-budget';

const root = resolve(import.meta.dirname, '..');
const previous = JSON.parse(readFileSync(resolve(root, 'deployments/preflight.json'), 'utf8'));
const candidate = JSON.parse(readFileSync(resolve(root, 'contracts/out/PortionCore.sol/PortionCore.json'), 'utf8'));
const account: string = previous.deployer;
const costOrigin = '5F4ZyJJ8R3QHZKRLAfDXdUuVE4w3Q7uq7tCNfAtvf2XEBfYY';
const units = (value: bigint) => formatUnits(value, 14, 14).replaceAll(',', '');
const buffer = 40n * 10n ** 14n;
const api = await connect(process.env.PORTALDOT_WS ?? TESTNET.ws);
try {
  if (api.runtimeVersion.specName.toString() !== 'portaldot-v3') throw new Error('Unexpected runtime.');
  const finalized = await api.rpc.chain.getFinalizedHead();
  const at = await api.at(finalized);
  const balance = await at.query.system.account(account);
  const free = BigInt((balance as any).data.free.toString());
  const frozen = BigInt((balance as any).data.frozen.toString());
  const spendable = free > frozen ? free - frozen : 0n;
  const proposals = [
    { name: 'Portion', abi: PortionArtifact.abi, bytecode: PortionArtifact.bytecode, args: [ss58ToH160(account), 1] },
    { name: 'PortionCore', abi: candidate.abi, bytecode: candidate.bytecode.object as string, args: [assetErc20Address(4217), ss58ToH160(account), 1] },
  ];
  const contracts = [];
  for (const proposal of proposals) {
    const code = encodeInitCode(proposal.abi, proposal.bytecode, proposal.args);
    const dry = await dryRunInstantiate(api, costOrigin, code);
    // This rejects failed/reverted constructors; they never become zero-cost estimates.
    const budget = deploymentBudget([{ name: proposal.name, dry }], buffer);
    const limits = withMargin(dry);
    const info = await api.tx.revive.instantiateWithCode(0, limits.weight, limits.deposit, code, '0x', null).paymentInfo(account);
    const fee = BigInt(info.partialFee.toString());
    contracts.push({
      name: proposal.name,
      creationBytes: (proposal.bytecode.length - 2) / 2,
      bytecodeSha256: createHash('sha256').update(proposal.bytecode).digest('hex'),
      constructorDryRunPassed: true,
      storageDepositTPOT: units(dry.deposit),
      budgetedStorageDepositTPOT: units(limits.deposit),
      estimatedDeploymentFeeTPOT: units(fee),
      budgetWithOperatingBufferAndDeploymentFeeTPOT: units(budget + fee),
      shortfallTPOT: units(budget + fee > spendable ? budget + fee - spendable : 0n),
      funded: spendable >= budget + fee,
    });
  }
  const report = {
    kind: 'read-only-core-candidate-comparison', checkedAt: new Date().toISOString(),
    genesisHash: api.genesisHash.toHex(), runtime: api.runtimeVersion.specName.toString(), specVersion: api.runtimeVersion.specVersion.toString(),
    finalizedBlock: (await api.rpc.chain.getHeader(finalized)).number.toNumber(), finalizedHash: finalized.toHex(),
    account, freeTPOT: units(free), spendableTPOT: units(spendable), accountNonce: (balance as any).nonce.toString(),
    operatingBufferTPOT: units(buffer), contracts,
    codeDepositConstants: {
      perByte: api.consts.revive.depositPerByte.toString(), perItem: api.consts.revive.depositPerItem.toString(),
      codeHashLockupPercentPartsPerBillion: api.consts.revive.codeHashLockupDepositPercent.toString(),
    },
    candidateUsedByPublishedApp: false, submittedTransactions: false,
    note: 'The candidate changes the ABI and uses hashed documents for metadata. SDK/indexer integration and live lifecycle proof are outstanding. The buffer is provisional, not a measured full seed/e2e budget. This file is not a deployment.',
  };
  writeFileSync(resolve(root, 'deployments/core-candidate.json'), JSON.stringify(report, null, 2) + '\n');
  for (const contract of contracts) console.log(`${contract.name}: ${contract.storageDepositTPOT} tPOT deposit; ${contract.budgetWithOperatingBufferAndDeploymentFeeTPOT} tPOT provisional budget; funded=${contract.funded}`);
  console.log(`Wallet remains ${report.freeTPOT} tPOT; nonce ${report.accountNonce}. No transactions submitted.`);
} finally { await api.disconnect(); }
