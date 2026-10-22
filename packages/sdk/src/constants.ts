export interface NetworkConfig {
  id: string;
  name: string;
  ws: string;
  evmRpc: string;
  chainId: number;
  symbol: string;
  decimals: number;
  explorer: string;
}

export const TESTNET: NetworkConfig = {
  id: 'portaldot-v3-testnet',
  name: 'Portaldot V3 Testnet',
  ws: 'wss://test-node-v3.portaldot.dev',
  evmRpc: 'https://test-evm-rpc-v3.portaldot.dev',
  chainId: 420420777,
  symbol: 'tPOT',
  decimals: 14,
  explorer: 'https://node-console.portaldot.dev/?rpc=wss%3A%2F%2Ftest-node-v3.portaldot.dev#/explorer',
};

/** AssetsPrecompiles prefix on Portaldot V3 (found by probing the live RPC: asset 1 answers `symbol()` here). */
export const ASSET_PRECOMPILE_PREFIX = 1;

export const POT_DECIMALS = 14;
export const PUSD_DECIMALS = 6;

/** Public, unfunded-on-purpose account used only as the *origin* of read-only runtime-API dry runs. */
export const VIEW_ORIGIN = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

export const CATEGORIES = [
  'Energy',
  'Mobility',
  'Food & agriculture',
  'Retail & kiosks',
  'Equipment & machines',
  'Real estate',
  'Media & IP',
  'Other',
] as const;

export const CADENCES = [
  { label: '2 minutes (testnet)', seconds: 120 },
  { label: 'Daily', seconds: 86_400 },
  { label: 'Weekly', seconds: 604_800 },
  { label: 'Monthly', seconds: 2_592_000 },
] as const;
