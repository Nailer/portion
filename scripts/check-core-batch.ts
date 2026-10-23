// Read-only runtime execution: the signed payload is sent only to system_dryRun, never author_submitExtrinsic.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CoreClient, contentHash, type Deployment } from '@portion/sdk';
const root = resolve(import.meta.dirname, '..');
const d = JSON.parse(readFileSync(resolve(root, 'deployments/portaldot-testnet.json'), 'utf8')) as Deployment;
const { setup } = await import('./lib');
const { api, deployer } = await setup();
try {
  const client = new CoreClient(api, d, { catalog: async () => [], document: async () => null });
  const assetId = await client.freeAssetId(); const nftItem = await client.freeNftItem();
  const plan = await client.planTokenize({ address: d.deployer } as any, {
    assetId, nftItem, name: 'Read-only protocol validation', summary: 'Not a published asset', category: 0,
    totalShares: 100, sharesForSale: 100, salePrice: 1_000_000n, cadence: 604800, minPerPeriod: 1_000_000n,
    bond: 5_000_000n, docHash: contentHash(new TextEncoder().encode('read-only validation')), coverHash: contentHash(new Uint8Array([1])),
  });
  const finalized = await api.rpc.chain.getFinalizedHead();
  const state = await api.at(finalized);
  const account: any = await state.query.system.account(d.deployer);
  const listing: any = { id: assetId, assetId, vault: { salePrice: 1_000_000n } };
  const plans = [plan, client.planBuy(listing, 2), client.planDeposit(listing, 1_000_000n), client.planClaim([assetId])];
  const combined = api.tx.utility.batchAll(plans.flatMap(part => part.tx.method.section === 'utility' ? Array.from(part.tx.method.args[0] as any) as any[] : [part.tx.method]));
  await combined.signAsync(deployer, { nonce: account.nonce, era: 0 });
  let result: unknown;
  let passed = false;
  try { const outcome = await api.rpc.system.dryRun(combined.toHex(), finalized); passed = outcome.isOk && outcome.asOk.isOk; result = outcome.toHuman(); }
  catch (error) { result = { unavailable: (error as Error).message }; }
  const traces: unknown[] = [];
  const calls = Array.from(plan.tx.method.args[0] as any) as any[];
  for (let count = 1; count <= calls.length; count++) {
    const trial = api.tx.utility.batchAll(calls.slice(0, count));
    await trial.signAsync(deployer, { nonce: account.nonce, era: 0 });
    const outcome: any = await api.rpc.system.dryRun(trial.toHex(), finalized);
    let detail: unknown = outcome.toHuman();
    if (outcome.isOk && outcome.asOk.isErr && outcome.asOk.asErr.isModule) {
      const error = api.registry.findMetaError(outcome.asOk.asErr.asModule);
      detail = `${error.section}.${error.name}: ${error.docs.join(' ')}`;
    }
    traces.push({ throughCall: count, call: `${calls[count - 1].section}.${calls[count - 1].method}`, result: detail });
  }
  const report = { checkedAt: new Date().toISOString(), contract: d.portion, kind: 'read-only-native-batch-check', passed, actions: ['native deed', 'fractional shares', 'asset registration', 'purchase', 'revenue deposit', 'claim'], beforeFree: account.data.free.toString(), afterFree: ((await api.query.system.account(d.deployer)) as any).data.free.toString(), signature: 'valid-read-only-simulation', submitted: false, beforeNonce: account.nonce.toString(), afterNonce: ((await api.query.system.account(d.deployer)) as any).nonce.toString(), result, traces };
  writeFileSync(resolve(root, 'deployments/core-batch-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await api.disconnect(); }
