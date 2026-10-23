import { readFileSync, writeFileSync } from 'node:fs';
import { setup, root } from './lib';
import { resolve } from 'node:path';
import { submit, nativeFree } from '@portion/sdk';
const file=resolve(root,'deployments/portion-test-listing.json');const saved=JSON.parse(readFileSync(file,'utf8'));
const {api,deployer}=await setup();try {
 const config:any=(await api.query.nfts.itemConfigOf(9,saved.nftItem)).toJSON();
 if((BigInt(config.settings)&1n)===1n){console.log('Already locked.');}
 else {
 const tx=api.tx.nfts.lockItemTransfer(9,saved.nftItem);
 const head=await api.rpc.chain.getFinalizedHead();const state=await api.at(head);const account:any=await state.query.system.account(deployer.address);await tx.signAsync(deployer,{nonce:account.nonce,era:0});const dry=await api.rpc.system.dryRun(tx.toHex(),head);
 console.log(JSON.stringify({dryRun:dry.toHuman()}));
 if(!dry.isOk||!dry.asOk.isOk)throw new Error('Lock rehearsal failed');
 if(process.argv.includes('--execute')){
  const fee=BigInt((await tx.paymentInfo(deployer.address)).partialFee.toString());if(await nativeFree(api,deployer.address)<40n*10n**14n+fee)throw new Error('Reserve guard');
  const out=await submit(api,tx,deployer);saved.deedLock={hash:out.txHash,block:out.blockNumber,ok:out.ok};writeFileSync(file,JSON.stringify(saved,null,2)+'\n');console.log(JSON.stringify(saved.deedLock));if(!out.ok)throw new Error(out.error);
 }
 }
}finally{await api.disconnect();}
