// Puts the live deployment into a state worth showing: bridge liquidity, three listings with history, one market.
//   npm run seed
import { Keyring } from '@polkadot/keyring';
import { generateCover, contentHash, storeTx, submit, parseUnits, PortionClient, ReviveContract, TeleportArtifact, FALLBACK_LIMITS, h160ToFallbackSs58, assetErc20Address, type Deployment } from '@portion/sdk';
import { setup, readDeployment, log } from './lib';

const { api, deployer } = await setup();
const d = readDeployment() as Deployment;
if (!d.portion) throw new Error('Run `npm run deploy` first.');
const client = new PortionClient(api, d);
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
const enc = new TextEncoder();
const U = (n: number) => BigInt(Math.round(n * 1e6));
const POT = (n: number) => BigInt(Math.round(n * 1e14));

// an investor account derived from the deployer mnemonic, so the seed is repeatable
const investor = keyring.addFromUri(`${process.env.DEPLOYER_MNEMONIC}//investor`);
log('investor', investor.address);

async function run(label: string, tx: any, who = deployer) {
  const out = await submit(api, tx, who);
  if (!out.ok) throw new Error(`${label}: ${out.error}`);
  log(`${label} ✓ block ${out.blockNumber}`);
  return out;
}

// 1 ── fund the investor
await run('fund investor', api.tx.utility.batchAll([api.tx.balances.transferKeepAlive(investor.address, POT(40)), api.tx.assets.transfer(d.pusdAssetId, investor.address, U(20_000))]));

// 2 ── bridge liquidity
if (d.teleport) {
  const tele = new ReviveContract(api, d.teleport, TeleportArtifact.abi);
  const acct = h160ToFallbackSs58(d.teleport);
  const data = tele.encode('addLiquidity', [U(25_000)]);
  await run('Teleport liquidity', api.tx.utility.batchAll([api.tx.assets.approveTransfer(d.pusdAssetId, acct, U(25_000)), api.tx.revive.call(d.teleport, 0n, FALLBACK_LIMITS.weight, FALLBACK_LIMITS.deposit, data)]));
}

// 3 ── listings
const SEEDS = [
  { name: 'Yaba solar charging kiosk', summary: 'Phone and powerbank charging for a busy bus stop. About 120 charges a day.', category: 0, shares: 1000, sale: 600, price: 12, cadence: 604_800, minPer: 90, terms: 'Operator reports takings weekly and pays at least $90 into the vault. Panel and inverter are insured. Bond is slashed after two missed weeks. (Seed listing created by the Portion team for the hackathon demo.)' },
  { name: 'Okada fleet, 6 electric bikes', summary: 'Six e-bikes leased to riders on a daily fee, with a fixed charging station.', category: 1, shares: 2400, sale: 1800, price: 5, cadence: 86_400, minPer: 25, terms: 'Daily rider fees are pooled by the fleet manager and paid into the vault each day. (Seed listing created by the Portion team for the hackathon demo.)' },
  { name: 'Two-minute demo kiosk', summary: 'A listing with a 2-minute payment cadence so you can watch the bond clock and a slash happen live.', category: 3, shares: 500, sale: 400, price: 4, cadence: 120, minPer: 10, terms: 'This listing exists to demonstrate enforcement. It promises $10 every 2 minutes. If the operator stops, the keeper slashes the bond after 4 minutes and holders are paid out. (Seed listing created by the Portion team for the hackathon demo.)' },
];
const existing = await client.count();
const ids: number[] = [];
for (const [i, s] of SEEDS.entries()) {
  if (i < existing) { ids.push(i); continue; }
  const cover = enc.encode(generateCover(s.name, s.category));
  const terms = enc.encode(JSON.stringify({ v: 1, name: s.name, summary: s.summary, category: s.category, terms: s.terms, createdAt: new Date().toISOString() }));
  await run(`${s.name}: store terms`, storeTx(api, terms));
  await run(`${s.name}: store cover`, storeTx(api, cover));
  const bond = (U(s.sale * s.price) * 500n) / 10_000n + U(1);
  const plan = await client.planTokenize(
    { pair: deployer, address: deployer.address, h160: '', kind: 'import' },
    { name: s.name, summary: s.summary, category: s.category, totalShares: s.shares, sharesForSale: s.sale, salePrice: U(s.price), cadence: s.cadence, minPerPeriod: U(s.minPer), bond, docHash: contentHash(terms), coverHash: contentHash(cover) },
  );
  await run(`${s.name}: tokenize (atomic batch)`, plan.tx);
  const [found, id] = await client.contract.read('idOfAsset', [plan.assetId]);
  if (!found) throw new Error('listing was not registered');
  ids.push(Number(id));
}

// 4 ── an investor buys into each, the operator pays in once
for (const [i, id] of ids.entries()) {
  const l = await client.listing(id);
  if (l.vault.sold === 0 && l.vault.forSale > 0) {
    const shares = Math.max(1, Math.round(l.vault.forSale * 0.25));
    await run(`investor buys ${shares} of #${id}`, client.planBuy(l, shares).tx, investor);
  }
  if (l.vault.deposits === 0) await run(`operator pays into #${id}`, client.planDeposit(await client.listing(id), l.minPerPeriod + U(2), 'week 1').tx);
  void i;
}

// 5 ── open a native-DEX market for the first listing
const first = await client.listing(ids[0]);
if (!(await client.api.query.assetConversion.pools.keys()).length) {
  const spare = 40;
  await run('open the market for listing #0', api.tx.utility.batchAll([
    api.tx.assetConversion.createPool({ WithId: first.assetId }, { WithId: d.pusdAssetId }),
    api.tx.assetConversion.addLiquidity({ WithId: first.assetId }, { WithId: d.pusdAssetId }, spare, U(spare * 12.5), 0, 0, deployer.address),
  ]));
}
log('seed complete:', ids.map((i) => `#${i}`).join(', '), '| ERC-20 of pUSD:', assetErc20Address(d.pusdAssetId));
await api.disconnect();
process.exit(0);
