import type { ApiPromise } from '@polkadot/api';
import type { KeyringPair } from '@polkadot/keyring/types';
import { dryRunInstantiate, encodeInitCode, explainRevert, withMargin, type DeployResult } from './revive';
import { submit, type TxStage } from './tx';
import { Interface } from 'ethers';

export interface Artifact {
  contractName: string;
  abi: any[];
  bytecode: string;
}

/**
 * Deploys standard solc output to Portaldot V3.
 * Two facts learned from the live runtime: (1) constructor arguments must be appended to the code blob and the
 * `data` field left empty (EVM constructors reject `data`), and (2) the storage deposit is charged per byte of code
 * and is refundable, so deployers need a few hundred tPOT of float.
 */
export async function deployContract(
  api: ApiPromise,
  pair: KeyringPair,
  artifact: Artifact,
  args: unknown[] = [],
  onStage?: (s: TxStage, detail?: string) => void,
): Promise<DeployResult> {
  const code = encodeInitCode(artifact.abi, artifact.bytecode, args);
  const dry = await dryRunInstantiate(api, pair.address, code);
  if (!dry.ok) throw new Error(`${artifact.contractName}: dry-run failed: ${dry.error}`);
  if (dry.reverted) throw new Error(`${artifact.contractName}: constructor reverted: ${explainRevert(new Interface(artifact.abi), dry.data)}`);
  const limits = withMargin(dry);
  const tx = api.tx.revive.instantiateWithCode(0, limits.weight, limits.deposit, code, '0x', null);
  const out = await submit(api, tx, pair, onStage);
  if (!out.ok) throw new Error(`${artifact.contractName}: deploy failed: ${out.error}`);
  const rec = out.events.find((e) => (api.events as any).revive.Instantiated.is(e.event));
  if (!rec) throw new Error(`${artifact.contractName}: no Instantiated event found`);
  const address = (rec.event.data as any).contract.toHex() as string;
  return { address, blockHash: out.blockHash, txHash: out.txHash };
}
