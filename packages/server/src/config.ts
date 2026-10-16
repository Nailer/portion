import { config as loadEnv } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Deployment } from '@portion/sdk';
import { TESTNET } from '@portion/sdk';

const root = resolve(import.meta.dirname, '../../..');
loadEnv({ path: resolve(root, '.env') });

export const config = {
  root,
  port: Number(process.env.PORT ?? 8787),
  ws: process.env.PORTALDOT_WS ?? TESTNET.ws,
  dbPath: process.env.DB_PATH ?? resolve(root, 'data/portion.sqlite'),
  deployerMnemonic: process.env.DEPLOYER_MNEMONIC ?? '',
  keeperMnemonic: process.env.KEEPER_MNEMONIC || process.env.DEPLOYER_MNEMONIC || '',
  // faucet budget: deliberately small so the treasury lasts through judging
  drip: {
    pot: BigInt(process.env.DRIP_POT ?? 3) * 10n ** 14n,
    pusd: BigInt(process.env.DRIP_PUSD ?? 500) * 10n ** 6n,
    cooldownSeconds: Number(process.env.DRIP_COOLDOWN ?? 24 * 3600),
    perIpPerDay: Number(process.env.DRIP_PER_IP ?? 5),
    globalPerDay: Number(process.env.DRIP_GLOBAL ?? 200),
  },
  evm: {
    portaldotRpc: process.env.PORTALDOT_EVM_RPC ?? 'https://test-evm-rpc-v3.portaldot.dev',
    bnbRpc: process.env.BNB_RPC ?? 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    opsKey: process.env.EVM_OPS_KEY ?? '',
    relayerKeys: [1, 2, 3].map((i) => process.env[`RELAYER_${i}_KEY`]).filter((k): k is string => !!k),
  },
  keepers: {
    enabled: process.env.KEEPERS !== 'off',
    intervalMs: Number(process.env.KEEPER_INTERVAL_MS ?? 30_000),
  },
};

export function loadDeployment(): Deployment | undefined {
  const file = resolve(root, 'deployments/portaldot-testnet.json');
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, 'utf8')) as Deployment;
}
