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

await cryptoWaitReady();
const deployment = loadDeployment();
const db = openDb(config.dbPath);
console.log(`[portion] connecting to ${config.ws}`);
const api = await connect(config.ws);
console.log(`[portion] connected: ${(await api.rpc.system.chain()).toString()} spec ${api.runtimeVersion.specVersion.toString()}`);
if (!deployment) console.warn('[portion] no deployments/portaldot-testnet.json yet: contract features are off until you run `npm run deploy`');

const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
if (!config.deployerMnemonic) console.warn('[portion] DEPLOYER_MNEMONIC missing: faucet and keepers are disabled. Run `npm run keygen`.');
const treasury = config.deployerMnemonic ? keyring.addFromUri(config.deployerMnemonic) : undefined;

const faucet = treasury ? new Faucet(api, db, treasury, deployment) : undefined;
const app = buildApp({ api, db, deployment, faucet, startedAt: Date.now() });

new Indexer(api, db, deployment).start().catch((e) => console.error('[indexer] failed to start', e));
if (config.keepers.enabled && config.keeperMnemonic) {
  new Keepers(api, db, keyring.addFromUri(config.keeperMnemonic), deployment, config.keepers.intervalMs).start();
}

serve({ fetch: app.fetch, port: config.port }, (i) => console.log(`[portion] API on http://localhost:${i.port}`));
