/**
 * Recorded testnet evidence, copied from deployments/*.json and docs/LIVE-TEST-RESULTS.md.
 * apps/web/test/evidence-record.test.ts compares every value with the JSON files so this cannot drift silently.
 * These are historical records, not live balances.
 */
export const RECORDED = {
  network: 'Portaldot V3 testnet',
  chainId: 420420777,
  core: { address: '0x17501f4510ba4298b618209e105cd47036509706', block: 160455, deployTx: '0x6bdc10ea83152665dc6d7007d217ee4648af6fe0d6efd7b3f4f6697911034b70' },
  paymentAssetId: 4217,
  deedCollection: 9,
  listing: { assetId: 585886, nftItem: 438052709, name: 'Portion Development — TEST ONLY', shares: 100 },
  steps: [
    { label: 'Terms document stored', block: 165542, hash: '0x53f078687cf6601698b7e07f7ba8beed6248342feb32bbaad38c42173e56f943' },
    { label: 'Image stored', block: 165547, hash: '0x4d23ac900909bc77045f9aa1e9e5f0d8da2043203e89153a10f289608b747327' },
    { label: 'Deed, shares, sale and bond created', block: 165551, hash: '0xb8ed7f04904bd53080fddf341fde1d8bc01a4dfdb88574af6cfd423bb7f82085' },
    { label: 'Bought 100 shares, deposited 1, claimed 0.995, unstaked', block: 165573, hash: '0x353098afddba251740dcc6f7d39b6a757fc8449d647cbb5ed40666c51e9bf912' },
  ],
  outcome: { sold: 100, deposited: '1.000000', fee: '0.005000', allocated: '0.995000', claimed: '0.995000' },
  limits: [
    'One development account acted as both operator and buyer.',
    'Test tokens have no monetary value; no customer, revenue or outside investor is involved.',
    'The recorded run used a script signer, not a separate user in a browser wallet.',
  ],
} as const;

export const shortHash = (h: string, head = 10, tail = 6) => `${h.slice(0, head)}…${h.slice(-tail)}`;
