// Explicit single-development-account test. No independent investor or business revenue is claimed.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CoreClient, submit, nativeFree, formatUnits } from '@portion/sdk';
import { setup, root } from './lib';
const {api,deployer}=await setup();
const file=resolve(root,'deployments/portion-test-listing.json');
const saved=JSON.parse(readFileSync(file,'utf8'));
const d=JSON.parse(readFileSync(resolve(root,'deployments/portaldot-testnet.json'),'utf8'));
const U=10n**14n;
try {
 if(saved.journey)throw new Error('Already completed; do not duplicate test transactions.');
 if(!saved.published || deployer.address!==saved.operator)throw new Error('Listing or signer not ready.');
 const source={catalog:async()=>await (await fetch('https://portion-one.vercel.app/api/catalog')).json() as any,document:async(hash:string)=>await (await fetch('https://portion-one.vercel.app/api/doc/'+hash)).json()};
 const client=new CoreClient(api,d,source);const l=await client.listing(saved.assetId);
 if(l.vault.sold!==0 || l.vault.forSale!==100)throw new Error('Listing already used; inspect before testing.');
 const plans=[client.planBuy(l,100),client.planDeposit(l,1_000_000n),client.planClaim([l.id]),client.planUnstake(l,100)];
 const calls=plans.flatMap(p=>p.tx.method.section==='utility'?Array.from(p.tx.method.args[0] as any) as any[]:[p.tx.method]);
 const limits=[5n,8n,5n,0n];let i=0;
 const bounded=calls.map((call:any)=>call.section==='revive' ? api.tx.revive.call(call.args[0],call.args[1],call.args[2],limits[i++]*U,call.args[4]).method : call);
 const tx=api.tx.utility.batchAll(bounded);
 const head=await api.rpc.chain.getFinalizedHead();const state=await api.at(head);const account:any=await state.query.system.account(deployer.address);
 const before=await nativeFree(api,deployer.address);
 await tx.signAsync(deployer,{nonce:account.nonce,era:0});const dry=await api.rpc.system.dryRun(tx.toHex(),head);
 console.log(JSON.stringify({dryRun:dry.toHuman(),beforeTPOT:formatUnits(before,14),actions:['buy all 100 test shares','deposit 1 test pUSD','claim','unstake and return test shares'],note:'A single atomic batch releases temporary stake storage before final settlement; the test offer closes after all test shares are bought.'}));
 if(!dry.isOk || !dry.asOk.isOk)throw new Error('Journey dry-run failed; nothing submitted.');
 if(!process.argv.includes('--execute')){console.log('Read-only.');}
 else {
  if(before<47n*U)throw new Error('Insufficient headroom to preserve test reserve.');
  const out=await submit(api,tx,deployer);
  saved.journey={hash:out.txHash,block:out.blockNumber,ok:out.ok,error:out.error,actions:['buy','deposit','claim','unstake'],singleDevelopmentAccount:true};
  saved.afterJourneyFree=(await nativeFree(api,deployer.address)).toString();
  saved.journeyEvents=out.events.filter(r=>['revive','balances','transactionPayment'].includes(r.event.section)).map(r=>({section:r.event.section,method:r.event.method,data:r.event.data.toJSON()}));
  writeFileSync(file,JSON.stringify(saved,null,2)+'\n');
  if(!out.ok)throw new Error(out.error);
  if(BigInt(saved.afterJourneyFree)<40n*U || BigInt(saved.beforeFree)-BigInt(saved.afterJourneyFree)>52n*U)throw new Error('STOP: test budget crossed; no further spending.');
  const published=await fetch('https://portion-one.vercel.app/api/receipts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({block:out.blockNumber,txHash:out.txHash})});
  if(!published.ok)throw new Error('Chain succeeded; retry receipt publication only.');
  console.log(JSON.stringify({receipt:saved.journey,remainingTPOT:formatUnits(BigInt(saved.afterJourneyFree),14),totalTestCostTPOT:formatUnits(BigInt(saved.beforeFree)-BigInt(saved.afterJourneyFree),14)}));
 }
}finally{await api.disconnect();}
