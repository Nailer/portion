import { withMargin, type DryRun } from '@portion/sdk';

/** Failed dry runs must never turn into an artificially cheap deployment estimate. */
export function deploymentBudget(contracts: { name: string; dry: DryRun }[], operatingBuffer: bigint): bigint {
  if (operatingBuffer < 0n) throw new Error('Operating buffer must not be negative.');
  let deposits = 0n;
  for (const { name, dry } of contracts) {
    if (!dry.ok || dry.reverted) throw new Error(`${name} deployment dry run did not succeed${dry.error ? `: ${dry.error}` : ''}. No deployment is allowed.`);
    deposits += withMargin(dry).deposit;
  }
  return deposits + operatingBuffer;
}
