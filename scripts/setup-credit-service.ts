// A separate issuer account can only mint test pUSD. Its small native gas budget is isolated.
import { mnemonicGenerate, cryptoWaitReady } from '@polkadot/util-crypto';
import { Keyring } from '@polkadot/keyring';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { submit, nativeFree, formatUnits } from '@portion/sdk';
import { setup, root } from './lib';
const { api, deployer } = await setup();
try {
  await cryptoWaitReady();
  const path = resolve(root, '.env.credit-service');
  const mnemonic = existsSync(path) ? readFileSync(path, 'utf8').trim().split('=')[1] : mnemonicGenerate();
  if (!existsSync(path)) writeFileSync(path, `PUSD_FAUCET_MNEMONIC=${mnemonic}\n`, { mode: 0o600 });
  const issuer = new Keyring({ type: 'sr25519', ss58Format: 42 }).addFromUri(mnemonic);
  const address = issuer.address;
  const free = await nativeFree(api, deployer.address);
  if (free < 73n * 10n ** 14n) throw new Error('Credit service setup cannot preserve the deployment reserve.');
  const funding = await nativeFree(api, address);
  const calls = [];
  if (funding < 2n * 10n ** 14n) calls.push(api.tx.balances.transferKeepAlive(address, 2n * 10n ** 14n - funding));
  const asset: any = (await api.query.assets.asset(4217)).toJSON();
  if (asset.issuer !== address) calls.push(api.tx.assets.setTeam(4217, address, deployer.address, deployer.address));
  if (calls.length) {
    const out = await submit(api, api.tx.utility.batchAll(calls), deployer);
    if (!out.ok) throw new Error(out.error);
    console.log(JSON.stringify({ issuer: address, txHash: out.txHash, block: out.blockNumber }));
  }
  console.log(JSON.stringify({ nativeGasBudgetTPOT: formatUnits(await nativeFree(api, address), 14), remainingDeploymentTPOT: formatUnits(await nativeFree(api, deployer.address), 14), serviceKeyStoredLocally: true }));
} finally { await api.disconnect(); }
