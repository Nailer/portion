import { serve } from '@hono/node-server';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { connect } from '@portion/sdk';
import { config, loadDeployment } from './config.js';
import { openDb } from './db.js';
import { Indexer } from './indexer.js';
import { Faucet } from './faucet.js';
import { Keepers } from './keepers.js';
import { buildApp } from './app.js';
import { Relayer, evmSide } from './relayer.js';

await cryptoWaitReady();
const deployment = loadDeployment();
const db = openDb(config.dbPath);
console.log(`[portion] connecting to ${config.ws}`);
const api = await connect(config.ws);
console.log(`[portion] connected: ${(await api.rpc.system.chain()).toString()} spec ${api.runtimeVersion.specVersion.toString()}`);
if (!deployment) console.warn('[portion] no deployments/portaldot-testnet.json yet: contract features are off until you run `npm run deploy`');

const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
if (config.faucet.enabled && !config.faucet.mnemonic) console.warn('[portion] Faucet disabled: set a separately funded FAUCET_MNEMONIC.');
if (config.keepers.enabled && !config.keeperMnemonic) console.warn('[portion] Keepers disabled: set a separately funded KEEPER_MNEMONIC.');
const treasury = config.faucet.enabled && config.faucet.mnemonic ? keyring.addFromUri(config.faucet.mnemonic) : undefined;

const faucet = treasury ? new Faucet(api, db, treasury, deployment) : undefined;
let relayer: Relayer | undefined;
if (config.relayer.enabled && deployment?.teleport && deployment.bnb && config.evm.opsKey && config.evm.relayerKeys.length >= 2) {
  relayer = new Relayer(db, [
    evmSide({ name: 'Portaldot V3', rpc: config.evm.portaldotRpc, chainId: deployment.chainId, gasKey: config.evm.opsKey, teleport: deployment.teleport, confirmations: 1, maxLogRange: 500 }),
    evmSide({ name: 'BNB Chain testnet', rpc: config.evm.bnbRpc, chainId: deployment.bnb.chainId, gasKey: config.evm.opsKey, teleport: deployment.bnb.teleport, confirmations: 3, maxLogRange: 2000 }),
  ], config.evm.relayerKeys);
  relayer.start();
  console.log('[portion] Teleport relayer running');
}
const app = buildApp({ api, db, deployment, faucet, startedAt: Date.now(), relayerRunning: !!relayer });

new Indexer(api, db, deployment).start().catch((e) => console.error('[indexer] failed to start', e));
if (config.keepers.enabled && config.keeperMnemonic) {
  new Keepers(api, db, keyring.addFromUri(config.keeperMnemonic), deployment, config.keepers.intervalMs).start();
}

serve({ fetch: app.fetch, port: config.port, hostname: config.host }, (i) => console.log(`[portion] API on http://localhost:${i.port}`));
