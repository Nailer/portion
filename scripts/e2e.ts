// Full lifecycle against the LIVE Portaldot V3 testnet, with fresh accounts. Writes an evidence report.
//   npm run e2e            core flow (about 2 minutes)
//   npm run e2e -- --slow  also waits out a 2-minute cadence and proves the bond slash
import { Keyring } from '@polkadot/keyring';
import { mnemonicGenerate } from '@polkadot/util-crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contentHash, storeTx, submit, generateCover, PortionClient, assetBalance, nativeFree, formatUnits, type Deployment } from '@portion/sdk';
import { verifyListing } from '../packages/server/src/verify';
import { setup, readDeployment, log, root } from './lib';

const SLOW = process.argv.includes('--slow');
const { api, deployer } = await setup();
const d = readDeployment() as Deployment;
if (!d.portion) throw new Error('Run `npm run deploy` first.');
const client = new PortionClient(api, d);
const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
const U = (n: number) => BigInt(Math.round(n * 1e6));
const POT = (n: number) => BigInt(Math.round(n * 1e14));

const evidence: { step: string; block?: number; tx: string }[] = [];
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` ${extra}` : ''}`); if (!ok) failed++; };
async function step(label: string, tx: any, who: any) {
  const out = await submit(api, tx, who);
  if (!out.ok) throw new Error(`${label} failed: ${out.error}`);
  evidence.push({ step: label, block: out.blockNumber, tx: out.txHash });
  log(`${label} (block ${out.blockNumber})`);
  return out;
}

try {
  const operator = keyring.addFromUri(mnemonicGenerate(12));
  const investor = keyring.addFromUri(mnemonicGenerate(12));
  const keeper = keyring.addFromUri(mnemonicGenerate(12));
  console.log('Portion live end-to-end\n');

  for (const [who, name] of [[operator, 'operator'], [investor, 'investor'], [keeper, 'keeper']] as const) {
    await step(`fund ${name}`, api.tx.utility.batchAll([api.tx.balances.transferKeepAlive(who.address, POT(12)), api.tx.assets.transfer(d.pusdAssetId, who.address, U(2_000))]), deployer);
  }

  // tokenize
  const cadence = SLOW ? 120 : 600;
  const cover = new TextEncoder().encode(generateCover('E2E kiosk', 0));
  const terms = new TextEncoder().encode(JSON.stringify({ v: 1, name: 'E2E kiosk', terms: 'end-to-end test listing', createdAt: new Date().toISOString() }));
  await step('store terms on-chain', storeTx(api, terms), operator);
  await step('store cover on-chain', storeTx(api, cover), operator);
  const plan = await client.planTokenize({ pair: operator, address: operator.address, h160: '', kind: 'import' }, {
    name: 'E2E kiosk', summary: 'created by the end-to-end test', category: 0, totalShares: 100, sharesForSale: 80, salePrice: U(10), cadence, minPerPeriod: U(20), bond: U(41), docHash: contentHash(terms), coverHash: contentHash(cover),
  });
  await step('tokenize: NFT + fractionalize + approvals + Solidity listing, one atomic extrinsic', plan.tx, operator);
  const [found, idBn] = await client.contract.read('idOfAsset', [plan.assetId]);
  check('listing registered in the Solidity contract', found);
  const id = Number(idBn);
  const l = await client.listing(id);
  check('escrow holds the shares for sale', (await client.shareBalance(l.assetId, client.contractAccount)) === 80n);

  const proof = await verifyListing(api, l);
  check('native proof: deed locked by the fractionalization pallet', proof.deedLocked);
  check('native proof: share supply fixed and pallet-administered', proof.supplyMatches && proof.adminIsPallet);

  // buy
  const pBefore = await client.pusdBalance(investor.address);
  await step('investor buys 20 shares', client.planBuy(l, 20).tx, investor);
  const paid = pBefore - (await client.pusdBalance(investor.address));
  check('buyer paid exactly 20 × price', paid === U(200), `(${formatUnits(paid, 6)} pUSD)`);
  check('shares are staked and earning', (await client.positions(investor.address)).some((p) => p.id === id && p.staked === 20));

  // revenue
  await step('operator pays in revenue', client.planDeposit(await client.listing(id), U(40), 'week 1').tx, operator);
  const pending = await client.pending(id, investor.address);
  check('investor sees pending revenue (20 of 20 staked shares → all net revenue)', pending > U(39) && pending <= U(40), `(${formatUnits(pending, 6)} pUSD)`);
  const beforeClaim = await client.pusdBalance(investor.address);
  await step('investor claims', client.planClaim([id]).tx, investor);
  check('claim paid out in pUSD', (await client.pusdBalance(investor.address)) - beforeClaim === pending);

  // DEX
  const spare = await client.shareBalance(l.assetId, operator.address);
  check('operator holds the unsold shares natively', spare === 20n);
  await step('operator opens a native DEX market', api.tx.utility.batchAll([
    api.tx.assetConversion.createPool({ WithId: l.assetId }, { WithId: d.pusdAssetId }),
    api.tx.assetConversion.addLiquidity({ WithId: l.assetId }, { WithId: d.pusdAssetId }, 10, U(110), 0, 0, operator.address),
  ]), operator);
  const pool = await client.api.call.assetConversionApi.getReserves({ WithId: l.assetId }, { WithId: d.pusdAssetId });
  check('pool exists with reserves', !pool.isEmpty);

  if (SLOW) {
    log(`waiting ${(2 * cadence) / 60 + 0.5} minutes for the operator to default…`);
    await new Promise((r) => setTimeout(r, (2 * cadence + 30) * 1000));
    const late = await client.listing(id);
    check('operator is now Defaulted', late.health === 'Defaulted', `(${late.health})`);
    const bond = late.vault.bond;
    const before = await client.pending(id, investor.address);
    const keeperBefore = await client.pusdBalance(keeper.address);
    await step('keeper slashes the bond', client.planSlash(id).tx, keeper);
    check('bond moved to share-holders', (await client.pending(id, investor.address)) > before);
    check('keeper earned its 1% tip', (await client.pusdBalance(keeper.address)) - keeperBefore === bond / 100n);
  }

  const lines = [
    '# Live end-to-end evidence', '', `Network: ${d.network} (chain ${d.chainId}), run at ${new Date().toISOString()}`, '',
    `Portion contract: \`${d.portion}\`  `, `pUSD asset id: ${d.pusdAssetId}  `, `Deeds collection: ${d.deedsCollection}`, '',
    '| Step | Block | Extrinsic hash |', '|---|---|---|', ...evidence.map((e) => `| ${e.step} | ${e.block ?? ''} | \`${e.tx}\` |`), '',
    failed ? `**${failed} check(s) failed.**` : '**All checks passed.**', '',
  ];
  writeFileSync(resolve(root, 'deployments/e2e-report.md'), lines.join('\n'));
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll live checks passed. Evidence written to deployments/e2e-report.md');
} catch (e) {
  console.error('✗ aborted:', e);
  failed++;
}
await api.disconnect();
process.exit(failed ? 1 : 0);
