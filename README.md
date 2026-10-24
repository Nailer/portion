# Portion

**Own a portion of things that earn.** Portion is being built for operators to offer shares in productive equipment and distribute revenue they deposit. The Core contract is live on the Portaldot V3 testnet. Publishing and funding use real testnet transactions and test tokens.
If the operator defaults, a submitted slashing transaction can allocate the limited bond under the contract rules. This is not automatic principal insurance. Purchase proceeds currently go directly to the operator; [funding and protection boundaries](docs/FUNDING-PROTECTION.md) explain the gap.

Built for the **Portaldot Hacker House 2026**, with **Ecosystem DApps** as the primary fit. Track eligibility and any additional award submission remain separate decisions.

| Scope | Current state |
|---|---|
| Core funding/accounting | Deployed testnet Core; finalized create/buy/deposit/claim/unstake evidence from one development account |
| SDK, documents and receipts | Versioned adapter, verified public copies and app-published finalized receipts; partial outside-transaction coverage |
| Wallet onboarding | Existing native injected-wallet signing design; full separate-user browser proof remains outstanding |
| Native tools | Direct network readings and optional native tools; verify each action before a demonstration |
| Bridge, automatic keepers, full archive | Legacy source/roadmap; not deployed ongoing services in this release |

Current deployment and validation: [live Core release](docs/LIVE-CORE-RELEASE.md) and [finalized protocol test](docs/LIVE-TEST-RESULTS.md). Hosted features use verified receipts and durable document copies; legacy keepers and the cross-chain bridge are not deployed.

## Delivery tasks and decisions

The [execution log](docs/planning/TASK-PROGRESS.md) records completed work. The [complete 56-task backlog](docs/planning/MASTER-BACKLOG.md) links to individual GitHub issues, priorities, dependencies and completion checks. The [42 plain-language answers](docs/planning/DECISIONS-AND-ANSWERS.md) explain product, wallet, cost, business and submission decisions and identify what still needs evidence.

## Business direction

Portion aims to become global infrastructure for companies managing funding and payouts for productive assets. The deployed Core contract charges a 1% sale fee and 0.5% revenue fee in test pUSD. Company management plans are a pricing hypothesis, not a feature currently charging customers. The [business plan](docs/BUSINESS.md) records costs, pilot criteria and limits; the app’s Revenue model page explains what still needs commercial validation.

## The idea in one picture

Portion composes native modules with Solidity accounting:

```
one signature  →  Nfts.mint            the deed
                  Nfts.setAttribute    the hash of its terms
                  NftFractionalization shares, with the deed's transfers switched off
                  Assets.approve ×2    offered-share and bond allowances
                  Revive.call          PortionCore.create  (Solidity)
```

All or nothing. Shares and the pUSD test-credit asset are *native assets* that Solidity sees as ordinary ERC-20 tokens through the runtime's `AssetsPrecompiles`, so no separate Solidity share/payment-token contract is required. This does not remove the need to review protocol/accounting and asset permissions. Terms and photo are stored by the chain's own `TransactionStorage`. Secondary trading uses the built-in `AssetConversion` DEX, when a real pool exists.

See [docs/research.md](docs/research.md) for the ecosystem research and why this idea, [docs/architecture.md](docs/architecture.md) for the design,
and [docs/TESTING.md](docs/TESTING.md) for how to check every claim.

New here? Open the [public preview](https://portion-one.vercel.app) and follow the [plain-language user and judge walkthrough](docs/WALKTHROUGH.md). Source: [Nailer/portion](https://github.com/Nailer/portion). The public preview reads the real testnet; the Core contract is deployed and its runtime bytecode is verified before actions are enabled. No simulation or fabricated opening balances are available. See [hosting scope](docs/HOSTING.md) for what Vercel publishes.

Account connection never asks for a recovery phrase. Approve a compatible browser-wallet connection for native testnet tools. Keys remain in the extension. No wallet is created by the app. See [account connection and legacy-data handling](docs/ACCOUNT-CONNECTION.md).

## Run it

Requirements: Node 22.13+ on the 22.x LTS line, Node 24, or Node 26+, and [Foundry](https://getfoundry.sh) only if you want to rebuild or test the contracts.

```bash
nvm install
nvm use
npx --yes npm@11.21.1 ci
PORTION_API_TARGET=https://portion-one.vercel.app npm run dev -w @portion/web
```

The public-service preview needs no local wallet/server secrets. For local API settings, complete checks and exact verified versions, follow [SETUP.md](docs/SETUP.md). `npm run dev` is the separate local API + frontend mode.

- <http://localhost:5173> uses the live Portaldot V3 testnet.

Local Core mode uses the hosted-style verified API and needs appropriate Blob configuration for publication; test-pUSD issuance additionally needs its separate issuer key/budget. Native grants and automatic keepers are not enabled by this Core path. Legacy service flags apply to legacy services only. See [hosting scope](docs/HOSTING.md); never put server secrets in frontend variables.

The current instance is already deployed. Only for a separately planned new instance:

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
| `npx tsx scripts/deploy-live-core.ts` | current bounded Core budget check; `--execute` is a separately budgeted write |
| Legacy deploy/bridge/e2e scripts | separate source paths; not instructions to recreate this live Core deployment |
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

See [hackathon readiness](docs/HACKATHON-READINESS.md) for verified requirements and remaining submission work, and [live test results](docs/LIVE-TEST-RESULTS.md) for dated costs and remaining balance. Historical preflights are not current funding requirements.

## Honest limits

- Operator revenue is self-reported. Bond + cadence make non-payment visible and expensive; they do not prove revenue. A production version would add payment-rail attestations.
- Legacy Teleport source assumes a relayer committee; no live bridge or light-client migration is claimed here.
- `pallet-nfts` lets an item's owner burn it; the proof panel will show "the deed no longer exists".
- Public document copies use verified finalized pins. App receipt history is partial; old/pruned outside transactions require their own recovery/archive path.
- Unaudited testnet software. tPOT and pUSD have no value.

## Credits and disclosures

Built from scratch during the hackathon window (14 Oct – 6 Nov 2026). Third-party code used as dependencies: Polkadot-JS, ethers, React, Vite, Hono, Foundry's forge-std (MIT), vitest.
Research notes cite public repositories from other hackathon teams only to describe the landscape; no code was copied. Licensed MIT.
