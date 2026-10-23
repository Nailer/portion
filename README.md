# Portion

**Own a portion of things that earn.** Portion is being built for operators to offer shares in productive equipment and distribute revenue they deposit. The Core contract is live on the Portaldot V3 testnet. Publishing and funding use real testnet transactions and test tokens.
If the operator stops paying, their bond is slashed to the people who hold shares.

Built for the **Portaldot Hacker House 2026**. It targets all four tracks with one product and one SDK:

| Track | What is here |
|---|---|
| **Ecosystem DApps** | The Portion app: market, tokenize wizard, portfolio, native-DEX trading, bond enforcement |
| **Modular Cloud & Middleware** | `@portion/sdk` (dual-VM client), on-chain document gateway with auto-renewal, indexer, open faucet |
| **Node Operations & Tooling** | Direct-RPC finalized-block console; server-side decentralization analysis, Pool Studio, permissionless auto-compound keeper, Prometheus metrics |
| **Multi-Chain & Cross-Chain** | Teleport: pUSD between Portaldot and BNB Chain testnet with a 2-of-3 relayer committee |

Current deployment and validation: [live Core release](docs/LIVE-CORE-RELEASE.md) and [finalized protocol test](docs/LIVE-TEST-RESULTS.md). Hosted features use verified receipts and durable document copies; legacy keepers and the cross-chain bridge are not deployed.

## Business direction

Portion aims to become global infrastructure for companies managing funding and payouts for productive assets. The deployed Core contract charges a 1% sale fee and 0.5% revenue fee in test pUSD. Company management plans are a pricing hypothesis, not a feature currently charging customers. The [business plan](docs/BUSINESS.md) records costs, pilot criteria and limits; the app’s Revenue model page explains what still needs commercial validation.

## The idea in one picture

Portaldot V3 is not just "an EVM chain". Its runtime ships about 70 native modules, and almost nothing uses them. Portion composes them:

```
one signature  →  Nfts.mint            the deed
                  Nfts.setAttribute    the hash of its terms
                  NftFractionalization shares, with the deed's transfers switched off
                  Assets.approve ×2    escrow for the sale, bond
                  Revive.call          Portion.createListing  (Solidity)
```

All or nothing. Shares and the pUSD stablecoin are *native assets* that Solidity sees as ordinary ERC-20 tokens through the runtime's `AssetsPrecompiles`, so there is no token contract
to deploy or audit. Terms and photo are stored by the chain's own `TransactionStorage`. Secondary trading uses the built-in `AssetConversion` DEX, when a real pool exists.

See [docs/research.md](docs/research.md) for the ecosystem research and why this idea, [docs/architecture.md](docs/architecture.md) for the design,
and [docs/TESTING.md](docs/TESTING.md) for how to check every claim.

New here? Open the [public preview](https://portion-one.vercel.app) and follow the [plain-language user and judge walkthrough](docs/WALKTHROUGH.md). Source: [Nailer/portion](https://github.com/Nailer/portion). The public preview reads the real testnet; the Core contract is deployed and its runtime bytecode is verified before actions are enabled. No simulation or fabricated opening balances are available. See [hosting scope](docs/HOSTING.md) for what Vercel publishes.

Account connection never asks for a recovery phrase. Approve a compatible browser-wallet connection for native testnet tools. Keys remain in the extension. No wallet is created by the app. See [account connection and legacy-data handling](docs/ACCOUNT-CONNECTION.md).

## Run it

Requirements: Node 22.13+ on the 22.x LTS line, Node 24, or Node 26+, and [Foundry](https://getfoundry.sh) only if you want to rebuild or test the contracts.

```bash
npm install
npm run dev            # API on :8787, web on :5173
```

- <http://localhost:5173> uses the live Portaldot V3 testnet.

The API starts with on-chain spending jobs disabled. Faucet and keeper services require `FAUCET=on` / `KEEPERS=on` and their own `FAUCET_MNEMONIC` / `KEEPER_MNEMONIC`; neither falls back to the deployment key. Fund those operational wallets separately only when needed. The bridge relayer also requires `RELAYER=on`. See `.env.example`.

To deploy your own instance:

```bash
npm run keygen         # writes .env (git-ignored) and prints the deployer address
# fund that address on the testnet
npx tsx scripts/deploy-live-core.ts # read-only bounded budget report
npx tsx scripts/deploy-live-core.ts --execute # only for a new deployment after preflight
# Then verify actual transactions; do not populate example business listings.
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API + web app |
| `npm run contracts:build` / `contracts:test` | compile + export artifacts / Foundry tests |
| `npm test` | contract tests + SDK tests |
| `npm run teleport:local` | two-chain bridge test on local anvil |
| `npm run deploy:check:core` / `deploy:core` | read-only core budget / resumable core deployment |
| `npm run deploy` · `deploy:bnb` · `e2e` | full deployment and evidence |
| `npm run typecheck` | all packages |

## Repository layout

```
contracts/       Solidity (Foundry): Portion.sol, Teleport.sol, WrappedToken.sol + tests
packages/sdk/    @portion/sdk: addresses, passports, revive, batches, documents, DEX
packages/server/ indexer, document gateway, faucet, keepers, network analysis, relayer
apps/web/        React app (Vite), real chain reads and deployment-gated asset actions
scripts/         keygen, deploy, e2e, local Teleport test
docs/            research, architecture, testing, submission pack
deployments/     addresses and evidence written by the scripts
```

See [hackathon readiness](docs/HACKATHON-READINESS.md) for verified requirements and remaining submission work, and [deployment preflight](deployments/preflight.md) for the latest read-only funding estimate.

## Honest limits

- Operator revenue is self-reported. Bond + cadence make non-payment visible and expensive; they do not prove revenue. A production version would add payment-rail attestations.
- Teleport v0 trusts a relayer committee. Portaldot already produces BEEFY/MMR commitments, which is the planned path to a light-client bridge.
- `pallet-nfts` lets an item's owner burn it; the proof panel will show "the deed no longer exists".
- The public RPC node prunes old blocks, so the document gateway indexes live and also accepts verified pins.
- Unaudited testnet software. tPOT and pUSD have no value.

## Credits and disclosures

Built from scratch during the hackathon window (14 Oct – 6 Nov 2026). Third-party code used as dependencies: Polkadot-JS, ethers, React, Vite, Hono, Foundry's forge-std (MIT), vitest.
Research notes cite public repositories from other hackathon teams only to describe the landscape; no code was copied. Licensed MIT.
