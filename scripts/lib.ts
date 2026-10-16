import { config as loadEnv } from 'dotenv';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect, type Deployment } from '@portion/sdk';

export const root = resolve(import.meta.dirname, '..');
loadEnv({ path: resolve(root, '.env') });

export const DEPLOYMENT_FILE = resolve(root, 'deployments/portaldot-testnet.json');

export async function setup() {
  await cryptoWaitReady();
  const mnemonic = process.env.DEPLOYER_MNEMONIC;
  if (!mnemonic) throw new Error('DEPLOYER_MNEMONIC is missing. Run `npm run keygen` first.');
  const keyring = new Keyring({ type: 'sr25519', ss58Format: 42 });
  const deployer = keyring.addFromUri(mnemonic);
  const api = await connect(process.env.PORTALDOT_WS);
  return { api, deployer, keyring };
}

export function readDeployment(): Partial<Deployment> & { deployedBlock?: number } {
  return existsSync(DEPLOYMENT_FILE) ? JSON.parse(readFileSync(DEPLOYMENT_FILE, 'utf8')) : {};
}

export function writeDeployment(d: unknown) {
  mkdirSync(resolve(root, 'deployments'), { recursive: true });
  writeFileSync(DEPLOYMENT_FILE, JSON.stringify(d, null, 2) + '\n');
}

export const log = (...a: unknown[]) => console.log('›', ...a);
