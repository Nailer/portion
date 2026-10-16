// Generates the keys this project needs and writes them to .env (never committed).
// Run once: `npm run keygen`. It prints only PUBLIC addresses.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { mnemonicGenerate, cryptoWaitReady, keccakAsU8a, encodeAddress } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';
import { u8aToHex, hexToU8a } from '@polkadot/util';
import { Wallet } from 'ethers';

await cryptoWaitReady();
const envPath = new URL('../.env', import.meta.url).pathname;
const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const has = (k) => new RegExp(`^${k}=`, 'm').test(existing);

let out = existing.trim() ? existing.trimEnd() + '\n' : '';
const added = [];
const add = (k, v) => { if (!has(k)) { out += `${k}=${v}\n`; added.push(k); } };

add('PORTALDOT_WS', 'wss://test-node-v3.portaldot.dev');
add('PORTALDOT_EVM_RPC', 'https://test-evm-rpc-v3.portaldot.dev');
add('DEPLOYER_MNEMONIC', has('DEPLOYER_MNEMONIC') ? '' : mnemonicGenerate(12));
for (let i = 1; i <= 3; i++) add(`RELAYER_${i}_KEY`, Wallet.createRandom().privateKey);
add('BNB_RPC', 'https://data-seed-prebsc-1-s1.bnbchain.org:8545');
// One EVM key deploys on BNB testnet and pays gas for relayed transfers on both chains.
add('EVM_OPS_KEY', Wallet.createRandom().privateKey);
writeFileSync(envPath, out);

const env = Object.fromEntries(out.split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const kr = new Keyring({ type: 'sr25519', ss58Format: 42 });
const pair = kr.addFromUri(env.DEPLOYER_MNEMONIC);
const h160 = '0x' + Buffer.from(keccakAsU8a(pair.publicKey)).subarray(12).toString('hex');
console.log(added.length ? `Wrote ${added.join(', ')} to .env` : '.env already complete');
console.log('\nDeployer / treasury (Substrate, SS58 prefix 42):', pair.address);
console.log('Same account as seen by Solidity (mapped H160): ', h160);
console.log('\nEVM ops account (BNB testnet deployer + relayer gas payer):', new Wallet(env.EVM_OPS_KEY).address);
console.log('\nRelayer signer addresses (they only sign, they hold no funds):');
for (let i = 1; i <= 3; i++) console.log(`  relayer ${i}:`, new Wallet(env[`RELAYER_${i}_KEY`]).address);
