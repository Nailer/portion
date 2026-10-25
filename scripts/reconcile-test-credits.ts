import { readFile } from 'node:fs/promises';
import { connect, TESTNET, decodeFailure, type Deployment } from '@portion/sdk';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { put } from '@vercel/blob';
import { blobCreditStore, creditOutcomeMatches } from '../packages/server/src/credit-control.js';

// Administrative storage repair only. No dotenv, issuer key, signing or mint call.
const args=process.argv.slice(2); const arg=(name:string)=>args[args.indexOf(name)+1];
if(!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('A securely configured server Blob token is required. Do not paste credentials into chat.');
const deployment=JSON.parse(await readFile(new URL('../deployments/portaldot-testnet.json',import.meta.url),'utf8')) as Deployment;
const prefix=`portion/core-v1/${deployment.portion.toLowerCase()}/`;
const store=blobCreditStore(prefix+'credit-control/v2.json'); const loaded=await store.load();
if(!loaded?.state.pending) { console.log('No pending credit reservation. No changes made.'); process.exit(0); }
const pending=loaded.state.pending; const apply=args.includes('--apply');
if(args.includes('--abort-reserved')) {
  if(pending.phase!=='reserved' || pending.nonce!==undefined || pending.callHash!==undefined) throw new Error('Signing may have started. A finalized matching transaction is required; no lock was cleared.');
  console.log(JSON.stringify({mode:apply?'apply':'preview',action:'release pre-sign reservation only',recipient:pending.address,attemptStillCounted:true}));
  if(apply) { const {pending:_,...settled}=loaded.state; await store.save(settled,loaded.etag); }
} else {
  const block=Number(arg('--block')); const txHash=arg('--hash');
  if(!Number.isSafeInteger(block) || block<1 || !/^0x[0-9a-f]{64}$/i.test(txHash??'')) throw new Error('Supply --block NUMBER --hash FULL_HASH, or --abort-reserved for a proven pre-sign reservation. Default mode is preview.');
  const api=await connect(TESTNET.ws);
  try {
    if(api.genesisHash.toHex()!=='0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd') throw new Error('Unexpected chain.');
    const final=await api.rpc.chain.getFinalizedHead(); if(block>(await api.rpc.chain.getHeader(final)).number.toNumber()) throw new Error('Block is not finalized.');
    const hash=await api.rpc.chain.getBlockHash(block); const [body,at]=await Promise.all([api.rpc.chain.getBlock(hash),api.at(hash)]);
    const index=body.block.extrinsics.findIndex(tx=>tx.hash.toHex().toLowerCase()===txHash.toLowerCase()); if(index<0) throw new Error('Transaction not found. Outcome remains unknown; no lock was cleared.');
    const tx=body.block.extrinsics[index]; if(!tx.isSigned) throw new Error('A signed issuer transaction is required.');
    const canonical=(address:string)=>encodeAddress(decodeAddress(address),42);
    const asset:any=(await at.query.assets.asset(deployment.pusdAssetId)).toJSON(); if(!asset?.issuer) throw new Error('Issuer identity unavailable.');
    if(!creditOutcomeMatches(loaded.state,{signer:canonical(tx.signer.toString()),nonce:tx.nonce.toString(),callHash:tx.method.hash.toHex()},canonical(asset.issuer))) throw new Error('Issuer, nonce or call differs from the pending request. No lock was cleared.');
    const events:any=await at.query.system.events(); const own=[...events].filter(row=>row.phase.isApplyExtrinsic && row.phase.asApplyExtrinsic.toNumber()===index);
    const error=decodeFailure(at as any,own); const success=own.some(row=>at.events.system.ExtrinsicSuccess.is(row.event));
    if(!error && !success) throw new Error('Final dispatch outcome unavailable.');
    console.log(JSON.stringify({mode:apply?'apply':'preview',recipient:pending.address,txHash,block,finalized:true,ok:success&&!error,error,attemptStillCounted:true},null,2));
    if(apply) {
      await put(prefix+`credits/${loaded.state.day}/${pending.address}`,JSON.stringify({status:error?'failed':'finalized',address:pending.address,tx:txHash,block}),{access:'public',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
      const {pending:_,...settled}=loaded.state; await store.save(settled,loaded.etag);
      console.log('Conditionally released the verified reservation. No mint was submitted.');
    }
  } finally { await api.disconnect(); }
}
