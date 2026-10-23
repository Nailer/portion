import { readFileSync, writeFileSync } from 'node:fs';
import { CoreClient, connect, nativeFree, ss58ToH160, formatUnits } from '@portion/sdk';
const file='deployments/portion-test-listing.json';const saved=JSON.parse(readFileSync(file,'utf8'));const d=JSON.parse(readFileSync('deployments/portaldot-testnet.json','utf8'));
const api=await connect();try {
 const source={catalog:async()=>await (await fetch('https://portion-one.vercel.app/api/catalog')).json() as any,document:async(hash:string)=>await (await fetch('https://portion-one.vercel.app/api/doc/'+hash)).json()};const c=new CoreClient(api,d,source);
 const l=await c.listing(saved.assetId);const pending=BigInt(await c.contract.read('pending',[l.id,ss58ToH160(saved.operator)]));const stake=await c.contract.read('stakes',[l.id,ss58ToH160(saved.operator)]);const shares:any=await api.query.assets.account(l.assetId,saved.operator);const config:any=(await api.query.nfts.itemConfigOf(l.nftCollection,l.nftItem)).toJSON();
 const free=await nativeFree(api,saved.operator);const cost=BigInt(saved.beforeFree)-free;
 const checks={sold:l.vault.sold,forSale:l.vault.forSale,saleOpen:l.saleOpen,revenuePUSD:l.vault.totalRevenue.toString(),pending:pending.toString(),staked:stake.amount.toString(),walletShares:shares.unwrap().balance.toString(),deedLocked:(BigInt(config.settings)&1n)===1n,remainingTPOT:formatUnits(free,14,8),totalTestTPOT:formatUnits(cost,14,8),withinBudget:cost<=52n*10n**14n&&free>=40n*10n**14n};
 if(checks.sold!==100||checks.forSale!==0||checks.saleOpen||checks.revenuePUSD!=='995000'||pending!==0n||BigInt(stake.amount)!==0n||checks.walletShares!=='100'||!checks.deedLocked||!checks.withinBudget)throw new Error(JSON.stringify(checks));
 saved.verifiedAt=new Date().toISOString();saved.finalVerification=checks;writeFileSync(file,JSON.stringify(saved,null,2)+'\n');console.log(JSON.stringify(checks));
}finally{await api.disconnect();}
