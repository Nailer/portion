// Read-only checks against the real Portaldot V3 testnet. They move no funds. Run with: LIVE=1 npm test -w @portion/sdk
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiPromise } from '@polkadot/api';
import { connect } from '../src/chain';
import { ReviveContract } from '../src/revive';
import { ERC20_ABI } from '../src/abi';
import { assetErc20Address, resolveH160Account, ss58ToH160 } from '../src/addresses';

const live = process.env.LIVE === '1';
let api: ApiPromise;

describe.runIf(live)('live testnet', () => {
  beforeAll(async () => {
    api = await connect();
  }, 30_000);
  afterAll(async () => {
    await api?.disconnect();
  });

  it('reports the V3 runtime', () => {
    expect(api.runtimeVersion.specName.toString()).toBe('portaldot-v3');
  });

  it('H160 mapping agrees with the runtime API', async () => {
    const ss58 = '5F4ZyJJ8R3QHZKRLAfDXdUuVE4w3Q7uq7tCNfAtvf2XEBfYY';
    const chain = (await (api.call as any).reviveApi.address(ss58)).toHex();
    expect(ss58ToH160(ss58)).toBe(chain);
  });

  it('registered H160 resolves back to its native account', async () => {
    const h = '0xdd62efd46da4acc4b8b2c7e3bf1685b2c9cee167';
    const chain = (await (api.call as any).reviveApi.accountId(h)).toString();
    expect(await resolveH160Account(api,h)).toBe(chain);
    expect(ss58ToH160(chain)).toBe(h);
  });

  it('a native asset is readable as an ERC-20 from Solidity-land', async () => {
    const erc20 = new ReviveContract(api, assetErc20Address(1), ERC20_ABI);
    expect(await erc20.read('symbol')).toBe('TST');
    expect(Number(await erc20.read('decimals'))).toBe(18);
  });
});
