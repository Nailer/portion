// Explicit test listing only. Default preflight; --execute submits, --publish retries public copies only.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CoreClient, contentHash, storeTx, submit, nativeFree, ss58ToH160, formatUnits, type Deployment } from '@portion/sdk';
import { setup, root } from './lib';
const execute = process.argv.includes('--execute');
const publishOnly = process.argv.includes('--publish');
const checkpoint = resolve(root, 'deployments/portion-test-listing.json');
const d = JSON.parse(readFileSync(resolve(root, 'deployments/portaldot-testnet.json'), 'utf8')) as Deployment;
const {api, deployer} = await setup();
const U = 10n ** 14n, RESERVE = 40n * U, MAX_BUDGET = 52n * U;
const saved: any = existsSync(checkpoint) ? JSON.parse(readFileSync(checkpoint,'utf8')) : {};
const save = () => writeFileSync(checkpoint, JSON.stringify(saved,null,2)+'\n');
const post = async(path: string, body: unknown) => {
 const r = await fetch('https://portion-one.vercel.app/api'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!r.ok) throw new Error(`Publication ${path}: ${r.status} ${await r.text()}`);
 return r.json();
};
try {
 if(api.genesisHash.toHex() !== '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd' || deployer.address !== d.deployer) throw new Error('Unexpected chain or signer');
 const client = new CoreClient(api,d,{catalog:async()=>[],document:async()=>null});
 const assetId = saved.assetId ?? await client.freeAssetId(); const nftItem = saved.nftItem ?? await client.freeNftItem();
 const cover = new Uint8Array(readFileSync(resolve(root,'apps/web/public/portion-symbol.png')));
 const terms = new TextEncoder().encode(JSON.stringify({v:1,assetId,nftItem,nftCollection:d.deedsCollection,coverHash:contentHash(cover),sharesForSale:100,name:'Portion Development — TEST ONLY',summary:'Protocol testing with test tokens. No physical equipment or real investment is represented.',category:7,terms:'Explicit development test authorized by the Portion team. Uses the Portion project logo, not an equipment photo. No physical asset, legal ownership, commercial funding or real business revenue is represented. 100 test shares offered at 1 test pUSD each; 5 test pUSD operator bond. Weekly test payment target: 1 test pUSD. Any deposits are protocol test credits, not business earnings. Test tokens have no monetary value and no returns are promised.'}));
 const plan = await client.planTokenize({address:deployer.address,h160:ss58ToH160(deployer.address)} as any,{assetId,nftItem,name:'Portion Development — TEST ONLY',summary:'Protocol testing only',category:7,totalShares:100,sharesForSale:100,salePrice:1_000_000n,cadence:604800,minPerPeriod:1_000_000n,bond:5_000_000n,docHash:contentHash(terms),coverHash:contentHash(cover)});
 const calls = Array.from(plan.tx.method.args[0] as any) as any[];
 const call:any = calls[calls.length-1];
 const storageCap=39n*U;
 if(process.argv.includes('--diagnose') && execute)throw new Error('Diagnostic cap cannot submit');
 const boundedCall=api.tx.revive.call(call.args[0],call.args[1],call.args[2],storageCap,call.args[4]);
 const tx=api.tx.utility.batchAll([...calls.slice(0,-1),boundedCall]);
 if(!saved.creation && !publishOnly){
  const free=await nativeFree(api,deployer.address);
  const fees=await Promise.all([storeTx(api,terms),storeTx(api,cover),tx].map(async part=>BigInt((await part.paymentInfo(deployer.address)).partialFee.toString())));
  if(process.argv.includes('--diagnose')) console.log(JSON.stringify(Object.fromEntries(['nfts','assets','nftFractionalization','transactionStorage'].map(p=>[p,Object.fromEntries(Object.entries((api.consts as any)[p]).map(([k,v])=>[k,(v as any).toString()]))]))));
  const finalized=await api.rpc.chain.getFinalizedHead();const at=await api.at(finalized);const account:any=await at.query.system.account(deployer.address);
  await tx.signAsync(deployer,{nonce:account.nonce,era:0});
  const dry=await api.rpc.system.dryRun(tx.toHex(),finalized);
  if(process.argv.includes('--diagnose')){for(const cap of [36n,37n,38n,39n]){const trial=api.tx.utility.batchAll([...calls.slice(0,-1),api.tx.revive.call(call.args[0],call.args[1],call.args[2],cap*U,call.args[4])]);await trial.signAsync(deployer,{nonce:account.nonce,era:0});const result=await api.rpc.system.dryRun(trial.toHex(),finalized);console.log(JSON.stringify({diagnosticCapTPOT:cap.toString(),result:result.toHuman()}));}}
  console.log(JSON.stringify({assetId,nftItem,freeTPOT:formatUnits(free,14),feeEstimateTPOT:formatUnits(fees.reduce((a,b)=>a+b,0n),14),maximumTotalTPOT:'52',contractStorageCapTPOT:(storageCap/U).toString(),minimumReserveTPOT:'40',dryRun:dry.toHuman(),coverBytes:cover.length,termsBytes:terms.length}));
  if(!dry.isOk || !dry.asOk.isOk){ if(dry.isOk && dry.asOk.asErr.isModule){const detail=api.registry.findMetaError(dry.asOk.asErr.asModule);throw new Error(`${detail.section}.${detail.name}: ${detail.docs.join(' ')}`);} throw new Error('Atomic creation dry-run failed'); }
  if(free<RESERVE+MAX_BUDGET && !saved.beforeFree)throw new Error('52 tPOT test budget would breach reserve');
  if(!execute){ console.log('Read-only preflight. Nothing submitted.'); process.exitCode=0; }
  else {
   Object.assign(saved,{assetId,nftItem,name:'Portion Development — TEST ONLY',testOnly:true,operator:deployer.address,beforeFree:free.toString(),docHash:contentHash(terms),coverHash:contentHash(cover),maximumBudgetTPOT:'52',minimumReserveTPOT:'40',createdAt:new Date().toISOString()});save();
   for(const [key,bytes] of [['terms',terms],['cover',cover]] as const){
    if(!saved[key]){if(await nativeFree(api,deployer.address)<RESERVE+46n*U)throw new Error('Reserve guard before document upload');const out=await submit(api,storeTx(api,bytes),deployer);if(!out.ok)throw new Error(out.error);saved[key]={hash:out.txHash,block:out.blockNumber};save();console.log(JSON.stringify({stage:key,...saved[key]}));}
    await post(`/doc/${contentHash(bytes)}/pin`,{block:saved[key].block});
   }
   if(await nativeFree(api,deployer.address)<RESERVE+46n*U)throw new Error('Reserve guard before listing');
   const out=await submit(api,tx,deployer);if(!out.ok){saved.failedCreation={hash:out.txHash,block:out.blockNumber,error:out.error};save();throw new Error(out.error);}
   saved.creation={hash:out.txHash,block:out.blockNumber};saved.afterFree=(await nativeFree(api,deployer.address)).toString();save();console.log(JSON.stringify({stage:'creation',...saved.creation,remainingTPOT:formatUnits(BigInt(saved.afterFree),14)}));
  }
 }
 if(saved.creation){await post(`/doc/${saved.docHash}/pin`,{block:saved.terms.block});await post(`/doc/${saved.coverHash}/pin`,{block:saved.cover.block});await post('/receipts',{block:saved.creation.block,txHash:saved.creation.hash});saved.published=true;save();console.log(JSON.stringify({published:true,url:`https://portion-one.vercel.app/listing/${assetId}`,receipt:saved.creation}));}
}finally{await api.disconnect();}
