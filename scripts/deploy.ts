// Deploys Portion to the Portaldot V3 testnet. Idempotent: re-running skips what already exists.
//   npm run deploy            full deployment
//   npm run deploy -- --check  only report what it would do and what it would cost
import { Wallet } from 'ethers';
import {
  PortionArtifact, TeleportArtifact, assetErc20Address, deployContract, formatUnits, nativeFree, ss58ToH160, submit,
  ReviveContract, assetExists, dryRunInstantiate, encodeInitCode, withMargin, type Deployment,
} from '@portion/sdk';
import { setup, readDeployment, writeDeployment, log } from './lib';

const CHECK = process.argv.includes('--check');
const PUSD_ID = 4217;
const BNB_TESTNET = 97;

const { api, deployer } = await setup();
const existing = readDeployment();
const d: Partial<Deployment> & { deployedBlock?: number } = { ...existing };
const stage = (label: string) => (s: string, detail?: string) => log(`${label}: ${s}${detail ? ` ${detail}` : ''}`);

const free = await nativeFree(api, deployer.address);
log(`deployer ${deployer.address} (${ss58ToH160(deployer.address)})`);
log(`balance ${formatUnits(free, 14, 3)} tPOT`);

// cost estimate from dry runs, so we fail early with a clear message instead of mid-way
const portionDry = await dryRunInstantiate(api, '5F4ZyJJ8R3QHZKRLAfDXdUuVE4w3Q7uq7tCNfAtvf2XEBfYY', encodeInitCode(PortionArtifact.abi, PortionArtifact.bytecode, [ss58ToH160(deployer.address), 1]));
const teleDry = await dryRunInstantiate(api, '5F4ZyJJ8R3QHZKRLAfDXdUuVE4w3Q7uq7tCNfAtvf2XEBfYY', encodeInitCode(TeleportArtifact.abi, TeleportArtifact.bytecode, [assetErc20Address(PUSD_ID), false, 10_000n * 10n ** 6n, 50_000n * 10n ** 6n]));
const need = withMargin(portionDry).deposit + withMargin(teleDry).deposit + 40n * 10n ** 14n;
log(`estimated deposit needed: ${formatUnits(need, 14, 0)} tPOT (refundable storage deposit for contract code, plus fees)`);
if (CHECK) { await api.disconnect(); process.exit(0); }
if (free < need && !(d.portion && d.teleport)) {
  console.error(`✗ Not enough tPOT. Have ${formatUnits(free, 14, 0)}, need about ${formatUnits(need, 14, 0)}. Fund ${deployer.address} and re-run.`);
  process.exit(1);
}

// 1 ── pUSD, the native stablecoin everything is priced in
if (!(await assetExists(api, PUSD_ID))) {
  log('creating native asset pUSD');
  const supply = 100_000_000n * 10n ** 6n;
  const tx = api.tx.utility.batchAll([
    api.tx.assets.create(PUSD_ID, deployer.address, 1),
    api.tx.assets.setMetadata(PUSD_ID, 'Portion Dollar', 'pUSD', 6),
    api.tx.assets.mint(PUSD_ID, deployer.address, supply),
  ]);
  const out = await submit(api, tx, deployer, stage('pUSD'));
  if (!out.ok) throw new Error(out.error);
  d.txs = { ...d.txs, pusd: out.txHash };
}
d.pusdAssetId = PUSD_ID;

// 2 ── the shared deeds collection, with public minting so any operator can mint into it
if (d.deedsCollection === undefined) {
  log('creating the Portion Deeds NFT collection');
  const config = { settings: 0, maxSupply: null, mintSettings: { mintType: { Public: null }, price: null, startBlock: null, endBlock: null, defaultItemSettings: 0 } };
  const out = await submit(api, api.tx.nfts.create(deployer.address, config), deployer, stage('deeds'));
  if (!out.ok) throw new Error(out.error);
  const ev: any = out.events.find((e) => (api.events as any).nfts.Created.is(e.event));
  d.deedsCollection = Number(ev.event.data[0].toString());
  const meta = await submit(api, api.tx.nfts.setCollectionMetadata(d.deedsCollection, 'portion:deeds:v1'), deployer);
  if (!meta.ok) log('collection metadata failed (non-fatal):', meta.error);
  d.txs = { ...d.txs, deeds: out.txHash };
}

// 3 ── contracts
const head = (await api.rpc.chain.getHeader()).number.toNumber();
if (!d.portion) {
  log('deploying Portion');
  const r = await deployContract(api, deployer, PortionArtifact, [ss58ToH160(deployer.address), 1], stage('Portion'));
  d.portion = r.address;
  d.txs = { ...d.txs, portion: r.txHash };
  log('Portion at', r.address);
}
if (!d.teleport) {
  log('deploying Teleport (home side)');
  const r = await deployContract(api, deployer, TeleportArtifact, [assetErc20Address(PUSD_ID), false, 10_000n * 10n ** 6n, 50_000n * 10n ** 6n], stage('Teleport'));
  d.teleport = r.address;
  d.txs = { ...d.txs, teleport: r.txHash };
  const tele = new ReviveContract(api, r.address, TeleportArtifact.abi);
  const relayers = [1, 2, 3].map((i) => new Wallet(process.env[`RELAYER_${i}_KEY`]!).address).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  const a = await tele.buildCall('setRelayers', [relayers, 2], { origin: deployer.address });
  const b = await tele.buildCall('setSupportedChain', [BNB_TESTNET, true], { origin: deployer.address });
  const out = await submit(api, api.tx.utility.batchAll([a.tx, b.tx]), deployer, stage('Teleport config'));
  if (!out.ok) throw new Error(out.error);
  log('Teleport at', r.address);
}

d.network = 'portaldot-v3-testnet';
d.chainId = 420420777;
d.treasury = deployer.address;
d.deployer = deployer.address;
d.deployedAt = d.deployedAt ?? new Date().toISOString();
d.deployedBlock = d.deployedBlock ?? head;
writeDeployment(d);
log('wrote deployments/portaldot-testnet.json');
console.log(JSON.stringify(d, null, 2));
await api.disconnect();
process.exit(0);
