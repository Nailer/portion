// Public-account, finalized-state reads only. No dotenv, keyring, signing or submit imports.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect, TESTNET, formatUnits, parseUnits } from '@portion/sdk';
const root = resolve(import.meta.dirname, '..');
const deployment = JSON.parse(readFileSync(resolve(root, 'deployments/portaldot-testnet.json'), 'utf8'));
const args = process.argv.slice(2);
const value = (name: string) => { const i = args.indexOf(name); if (i < 0) return undefined; if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${name} requires a value`); return args[i + 1]; };
const proposed = value('--budget-tpot');
if (proposed && !/^\d+(\.\d{1,14})?$/.test(proposed)) throw new Error('Use a nonnegative tPOT amount with at most 14 decimal places.');
const proposedCost = proposed === undefined ? undefined : parseUnits(proposed, 14);
const reserve = 40n * 10n ** 14n;
const api = await connect(TESTNET.ws);
try {
  if (api.genesisHash.toHex() !== '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd') throw new Error('Unexpected network.');
  const head = await api.rpc.chain.getFinalizedHead();
  const state = await api.at(head);
  const account = async (address: string) => {
    const row: any = await state.query.system.account(address);
    const free = BigInt(row.data.free.toString()); const frozen = BigInt(row.data.frozen.toString());
    return { address, freeBaseUnits: free.toString(), frozenBaseUnits: frozen.toString(), freeTPOT: formatUnits(free, 14, 14), frozenTPOT: formatUnits(frozen, 14, 14), spendable: free > frozen ? free - frozen : 0n, nonce: row.nonce.toString() };
  };
  const main = await account(deployment.deployer);
  const native: any = await state.query.assets.asset(deployment.pusdAssetId);
  const issuer = native.isSome ? await account(native.unwrap().issuer.toString()) : null;
  const headroom = main.spendable > reserve ? main.spendable - reserve : 0n;
  const report = { checkedAt: new Date().toISOString(), kind: 'read-only-finalized-budget', submitted: false, genesisHash: api.genesisHash.toHex(), finalizedBlock: (await api.rpc.chain.getHeader(head)).number.toNumber(), finalizedHash: head.toHex(), deployment: { ...main, spendable: undefined }, creditIssuer: issuer ? { ...issuer, spendable: undefined } : null, minimumRemainingTPOT: '40', maximumCurrentHeadroomTPOT: formatUnits(headroom, 14, 14), proposedMaximumCostTPOT: proposed ?? null, wouldPreserveReserve: proposedCost === undefined ? null : proposedCost <= headroom, notes: ['This reads public accounts only; no key or signing path is loaded.', 'Headroom is not a transaction quote or permission to spend. Budget fees, storage and failure cases before a write.', 'A storage cap is an upper allowance; locked deposits are not currently available spending money.', 'The credit issuer is separate; no deployer-funded native faucet is enabled.'] };
  if (args.includes('--save')) writeFileSync(resolve(root, 'deployments/operating-budget.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await api.disconnect(); }
