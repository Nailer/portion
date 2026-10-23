import { readFileSync } from 'node:fs';
import { connect } from '@portion/sdk';
const saved=JSON.parse(readFileSync('deployments/portion-test-listing.json','utf8'));
const api=await connect();try {for(const name of ['itemConfigOf','item']){const value=await (api.query.nfts as any)[name](9,saved.nftItem);console.log(JSON.stringify({name,json:value.toJSON(),human:value.toHuman(),hex:value.toHex()}));}}finally{await api.disconnect();}
