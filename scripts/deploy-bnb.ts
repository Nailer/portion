// Deploys the remote side of Teleport (wrapped token + bridge) to BNB Chain testnet.
//   npm run deploy:bnb
// Needs EVM_OPS_KEY funded with a little tBNB (https://www.bnbchain.org/en/testnet-faucet).
import { ContractFactory, JsonRpcProvider, Wallet, formatEther, parseUnits } from 'ethers';
import { TeleportArtifact, WrappedTokenArtifact } from '@portion/sdk';
import { readDeployment, writeDeployment, log, root } from './lib';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(root, '.env') });
const BNB_ID = 97;
const rpc = process.env.BNB_RPC ?? 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';
const key = process.env.EVM_OPS_KEY;
if (!key) throw new Error('EVM_OPS_KEY missing. Run `npm run keygen`.');

const d = readDeployment();
if (!d.teleport) throw new Error('Deploy the Portaldot side first: npm run deploy');

const provider = new JsonRpcProvider(rpc, BNB_ID, { staticNetwork: true, cacheTimeout: -1 });
const wallet = new Wallet(key, provider);
const balance = await provider.getBalance(wallet.address);
log(`BNB testnet deployer ${wallet.address}, balance ${formatEther(balance)} tBNB`);
if (balance < parseUnits('0.02', 18)) {
  console.error(`✗ Fund ${wallet.address} with at least 0.05 tBNB from the BNB testnet faucet, then re-run.`);
  process.exit(1);
}

const d2: any = d;
if (!d2.bnb) {
  const wf = new ContractFactory(WrappedTokenArtifact.abi, WrappedTokenArtifact.bytecode, wallet);
  const wp: any = await wf.deploy('Wrapped Portion Dollar', 'wpUSD', 6);
  await wp.waitForDeployment();
  log('wpUSD at', await wp.getAddress());

  const tf = new ContractFactory(TeleportArtifact.abi, TeleportArtifact.bytecode, wallet);
  const tele: any = await tf.deploy(await wp.getAddress(), true, parseUnits('10000', 6), parseUnits('50000', 6));
  await tele.waitForDeployment();
  log('Teleport (remote) at', await tele.getAddress());

  await (await wp.setBridge(await tele.getAddress())).wait();
  const relayers = [1, 2, 3].map((i) => new Wallet(process.env[`RELAYER_${i}_KEY`]!).address).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  await (await tele.setRelayers(relayers, 2)).wait();
  await (await tele.setSupportedChain(d.chainId, true)).wait();
  d2.bnb = { chainId: BNB_ID, teleport: await tele.getAddress(), wpusd: await wp.getAddress() };
  writeDeployment(d2);
  log('wrote deployments/portaldot-testnet.json');
}
console.log(JSON.stringify(d2.bnb, null, 2));
process.exit(0);
