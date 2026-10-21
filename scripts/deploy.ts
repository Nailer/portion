// Read-only preflight: npm run deploy:check. Core app only: npm run deploy:core.
// Checkpoints are saved after each successful step so partial deployments can resume.
import { Wallet } from 'ethers';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PortionArtifact, TeleportArtifact, assetErc20Address, deployContract, formatUnits, nativeFree, ss58ToH160, submit,
  ReviveContract, assetExists, dryRunInstantiate, encodeInitCode, withMargin, type Deployment,
} from '@portion/sdk';
import { deploymentBudget } from './deployment-budget';
import { setup, readDeployment, writeDeployment, log, root } from './lib';

const CHECK = process.argv.includes('--check');
const CORE = process.argv.includes('--core');
const PUSD_ID = 4217;
const BNB_TESTNET = 97;
const BUFFER = 40n * 10n ** 14n;
const COST_ORIGIN = '5F4ZyJJ8R3QHZKRLAfDXdUuVE4w3Q7uq7tCNfAtvf2XEBfYY';
const stage = (label: string) => (s: string, detail?: string) => log(`${label}: ${s}${detail ? ` ${detail}` : ''}`);
const units = (n: bigint) => formatUnits(n,14,14).replaceAll(',','');
const { api, deployer } = await setup();
try {
  if (api.runtimeVersion.specName.toString() !== 'portaldot-v3') throw new Error('Unexpected runtime. This script only supports the Portaldot V3 testnet.');
  const existing = readDeployment();
  if (existing.deployer && existing.deployer !== deployer.address) throw new Error('Existing deployment belongs to a different account. Review it before continuing.');
  if (existing.chainId && existing.chainId !== 420420777) throw new Error('Existing deployment has an unexpected chain id.');
  const d: Partial<Deployment> & { deployedBlock?: number } = { ...existing, network: 'portaldot-v3-testnet', chainId: 420420777, treasury: deployer.address, deployer: deployer.address };
  const checkpoint = () => writeDeployment(d);
  const finalized = await api.rpc.chain.getFinalizedHead();
  const at = await api.at(finalized);
  const account: any = await at.query.system.account(deployer.address);
  const free = BigInt(account.data.free.toString());
  const frozen = BigInt(account.data.frozen.toString());
  const spendable = free > frozen ? free - frozen : 0n;
  log(`deployer ${deployer.address}`);
  log(`balance ${units(free)} tPOT; spendable ${units(spendable)} tPOT`);

  // Use a funded read-only origin for cost discovery; deployContract rechecks the actual signer before signing.
  const portionDry = await dryRunInstantiate(api,COST_ORIGIN,encodeInitCode(PortionArtifact.abi,PortionArtifact.bytecode,[ss58ToH160(deployer.address),1]));
  const teleportDry = await dryRunInstantiate(api,COST_ORIGIN,encodeInitCode(TeleportArtifact.abi,TeleportArtifact.bytecode,[assetErc20Address(PUSD_ID),false,10_000n*10n**6n,50_000n*10n**6n]));
  const coreContracts = d.portion ? [] : [{ name:'Portion',dry:portionDry }];
  const fullContracts = [...coreContracts,...(d.teleport ? [] : [{ name:'Teleport',dry:teleportDry }])];
  const coreNeed = deploymentBudget(coreContracts,BUFFER);
  const fullNeed = deploymentBudget(fullContracts,BUFFER);
  const need = CORE ? coreNeed : fullNeed;
  const report = {
    kind:'read-only-deployment-preflight', checkedAt:new Date().toISOString(),
    chain:(await api.rpc.system.chain()).toString(), runtime:api.runtimeVersion.specName.toString(), specVersion:api.runtimeVersion.specVersion.toString(),
    genesisHash:api.genesisHash.toHex(), finalizedBlock:(await api.rpc.chain.getHeader(finalized)).number.toNumber(), finalizedHash:finalized.toHex(),
    deployer:deployer.address, freeTPOT:units(free), spendableTPOT:units(spendable),
    portion:{dryRunPassed:portionDry.ok&&!portionDry.reverted,depositTPOT:units(portionDry.deposit),budgetedDepositTPOT:units(withMargin(portionDry).deposit),bytecodeSha256:createHash('sha256').update(PortionArtifact.bytecode).digest('hex')},
    teleport:{dryRunPassed:teleportDry.ok&&!teleportDry.reverted,depositTPOT:units(teleportDry.deposit),budgetedDepositTPOT:units(withMargin(teleportDry).deposit)},
    operatingBufferTPOT:units(BUFFER), coreBudgetTPOT:units(coreNeed), fullBudgetTPOT:units(fullNeed),
    coreShortfallTPOT:units(coreNeed>spendable?coreNeed-spendable:0n), fullShortfallTPOT:units(fullNeed>spendable?fullNeed-spendable:0n),
    coreFunded:spendable>=coreNeed, fullFunded:spendable>=fullNeed, submittedTransactions:false,
    note:'Cost discovery uses a funded read-only origin. Budgets add a storage margin and operating buffer; they are not exact fees and do not fund all seed/e2e accounts. Existing deployments are skipped. This file is not evidence of deployment.',
  };
  mkdirSync(resolve(root,'deployments'),{recursive:true});
  writeFileSync(resolve(root,'deployments/preflight.json'),JSON.stringify(report,null,2)+'\n');
  writeFileSync(resolve(root,'deployments/preflight.md'),[
    '# Read-only deployment preflight','',`Checked: ${report.checkedAt}`,`Finalized block: ${report.finalizedBlock}`,`Deployer: \`${deployer.address}\``,
    '', '| Item | tPOT |','|---|---:|',`| Spendable balance | ${report.spendableTPOT} |`,`| Portion estimated storage deposit | ${report.portion.depositTPOT} |`,
    `| Core app budget, including margin and buffer | ${report.coreBudgetTPOT} |`,`| Core app shortfall | ${report.coreShortfallTPOT} |`,
    `| Core + bridge budget | ${report.fullBudgetTPOT} |`,`| Core + bridge shortfall | ${report.fullShortfallTPOT} |`,
    '', 'Both contract constructors were dry-run. No transaction has been submitted by this preflight. The operating buffer is an estimate; seeding and end-to-end funding need additional checks.', '',
  ].join('\n'));
  log(`core budget ${report.coreBudgetTPOT} tPOT; shortfall ${report.coreShortfallTPOT}`);
  log(`core + bridge budget ${report.fullBudgetTPOT} tPOT; shortfall ${report.fullShortfallTPOT}`);
  log('read-only evidence saved to deployments/preflight.json and preflight.md');
  if (!CHECK) {
    if (spendable<need) throw new Error(`Insufficient funding for ${CORE?'core':'full'} deployment. Need budget ${units(need)} tPOT; spendable ${units(spendable)}. Nothing was submitted.`);
    if (!(await assetExists(api,PUSD_ID))) {
      const out=await submit(api,api.tx.utility.batchAll([
        api.tx.assets.create(PUSD_ID,deployer.address,1),api.tx.assets.setMetadata(PUSD_ID,'Portion Dollar','pUSD',6),api.tx.assets.mint(PUSD_ID,deployer.address,100_000_000n*10n**6n),
      ]),deployer,stage('pUSD'));
      if (!out.ok) throw new Error(out.error);
      d.pusdAssetId=PUSD_ID; d.txs={...d.txs,pusd:out.txHash}; checkpoint();
    } else {
      const asset:any=await api.query.assets.asset(PUSD_ID);
      const metadata:any=await api.query.assets.metadata(PUSD_ID);
      if (asset.unwrap().owner.toString()!==deployer.address || metadata.symbol.toUtf8()!=='pUSD' || metadata.decimals.toNumber()!==6) throw new Error('Asset 4217 already exists with an unexpected owner or metadata. Refusing to use it.');
      d.pusdAssetId=PUSD_ID;
    }
    if (d.deedsCollection===undefined) {
      const config={settings:0,maxSupply:null,mintSettings:{mintType:{Public:null},price:null,startBlock:null,endBlock:null,defaultItemSettings:0}};
      const out=await submit(api,api.tx.nfts.create(deployer.address,config),deployer,stage('deeds'));
      if (!out.ok) throw new Error(out.error);
      const ev:any=out.events.find(e=>(api.events as any).nfts.Created.is(e.event));
      if (!ev) throw new Error('Collection creation did not emit the expected event.');
      d.deedsCollection=Number(ev.event.data[0].toString());d.txs={...d.txs,deeds:out.txHash};checkpoint();
    }
    if (!d.portion) {
      const out=await deployContract(api,deployer,PortionArtifact,[ss58ToH160(deployer.address),1],stage('Portion'));
      d.portion=out.address;d.txs={...d.txs,portion:out.txHash};d.deployedAt=new Date().toISOString();d.deployedBlock=(await api.rpc.chain.getHeader()).number.toNumber();checkpoint();
    }
    if (!CORE) {
      if (!d.teleport) {
        const out=await deployContract(api,deployer,TeleportArtifact,[assetErc20Address(PUSD_ID),false,10_000n*10n**6n,50_000n*10n**6n],stage('Teleport'));
        d.teleport=out.address;d.txs={...d.txs,teleport:out.txHash};checkpoint();
      }
      if (!d.txs?.teleportConfig) {
        let relayers:string[];
        try { relayers=[1,2,3].map(i=>new Wallet(process.env[`RELAYER_${i}_KEY`] ?? '').address).sort((a,b)=>BigInt(a)<BigInt(b)?-1:1); }
        catch { throw new Error('Relayer key configuration is missing or invalid. Deployed addresses have been checkpointed.'); }
        const tele=new ReviveContract(api,d.teleport!,TeleportArtifact.abi);
        const a=await tele.buildCall('setRelayers',[relayers,2],{origin:deployer.address});
        const b=await tele.buildCall('setSupportedChain',[BNB_TESTNET,true],{origin:deployer.address});
        const out=await submit(api,api.tx.utility.batchAll([a.tx,b.tx]),deployer,stage('Teleport config'));
        if (!out.ok) throw new Error(out.error);
        d.txs={...d.txs,teleportConfig:out.txHash};checkpoint();
      }
    }
    checkpoint();log('deployment complete:',CORE?'core app':'core app + home bridge');
  }
} catch (e) { console.error((e as Error).message);process.exitCode=1; }
finally { await api.disconnect(); }
