# Portion

**Share what an asset earns, with a record everyone can check.** Portion lets an operator of productive equipment deposit revenue, split it among participants by their shares, and let each participant claim their part. The Core contract is live on the Portaldot V3 testnet; publishing, deposits and claims are real testnet transactions in test tokens that have no value.

Portion's first product is **revenue-sharing administration for operators**: terms, deposits, allocations, claims and receipts. Raising money through Portion is a secondary, test-only module. **Purchase proceeds currently go directly to the operator**, nothing verifies that equipment exists or that revenue is complete, and the operator bond is limited recovery, not principal insurance. See [funding and protection boundaries](docs/FUNDING-PROTECTION.md), the [money and trust lifecycle](docs/MONEY-AND-TRUST-LIFECYCLE.md), the [investment assessment](docs/INVESTMENT-ASSESSMENT.md) and the [market-readiness review](docs/MARKET-READINESS-REVIEW.md) of loopholes still to close.

Built for the **Portaldot Hacker House 2026**, with **Ecosystem DApps** as the primary fit. Track eligibility and any additional award submission remain separate decisions.

| Scope | Current state |
|---|---|
| Core funding/accounting | Deployed testnet Core; finalized create/buy/deposit/claim/unstake evidence from one development account |
| SDK, documents and receipts | Versioned adapter, verified public copies and app-published finalized receipts; partial outside-transaction coverage |
| Wallet onboarding | Existing native injected-wallet signing design; full separate-user browser proof remains outstanding |
| Native tools | Direct network readings and optional native tools; verify each action before a demonstration |
| Controlled-funding escrow | `contracts/src/candidates/ControlledFunding.sol`: 23 local tests; **not deployed, not in the app** ([candidate notes](docs/CONTROLLED-FUNDING-CANDIDATE.md)) |
| Core v2 (escrow, reviewers, pause) | `contracts/src/candidates/PortionCoreV2.sol`: closes or narrows review findings C1–C9, including purchase escrow with reviewer-approved release and refunds; supported by the SDK, API and app when a deployment names `core-v2`; **not deployed** (needs about 800–1,110 tPOT of storage deposit) ([candidate notes](docs/CORE-V2-CANDIDATE.md)) |
| Browser sandbox | `/sandbox` in the web app runs the Core v2 bytecode in an in-browser EVM with five labelled roles, pretend money and a time-skip control, so every feature can be tried without a wallet or tPOT. Clearly labelled as simulated; never written to real receipts ([sandbox and demo script](docs/SANDBOX.md)) |
| Bridge, automatic keepers, full archive | Legacy source/roadmap; not deployed ongoing services in this release |

Current deployment and validation: [live Core release](docs/LIVE-CORE-RELEASE.md) and [finalized protocol test](docs/LIVE-TEST-RESULTS.md). Hosted features use verified receipts and durable document copies; legacy keepers and the cross-chain bridge are not deployed.

## Project overview

**Problem.** People who run earning equipment, such as solar canopies, vehicles or machinery, often share income with the people who backed them. We expect most of this runs on spreadsheets, bank transfers and emailed statements, so backers take the numbers on trust. This is a working assumption: no operator has been interviewed yet.

**Solution.** An operator publishes hashed terms, a share count, a deposit schedule and a bond. Backers buy and stake shares. The operator deposits revenue, the contract splits it by staked shares after a 0.5% fee, and each holder claims their own part. Portion does not create revenue or guarantee returns.

**Blockchain relevance.** One all-or-nothing batch mints a native NFT deed, fractionalizes it into native shares and calls the Solidity contract, which reads those native assets as ERC-20 tokens through precompiles. A plain database could run the admin. Portaldot matters when backers must check the record themselves.

## Check it yourself

These read public endpoints only, need no wallet or keys, and spend nothing.

```bash
npm run verify:chain
```

This compiles the source and compares it with the deployed contract byte for byte, confirms the recorded transactions succeeded, then replays the contract's events and checks that the recomputed sales, stakes, revenue, payouts and token balances equal what the contract reports. Last result: [`deployments/chain-verification.json`](deployments/chain-verification.json).

| On chain | Reference | Open it |
|---|---|---|
| Core contract | `0x17501f4510ba4298b618209e105cd47036509706` | [Deployed in block 160,455](https://scanner-testnet-v3.portaldot.dev/#/extrinsics/160455-1) |
| Deployment | `0x6bdc10ea83152665dc6d7007d217ee4648af6fe0d6efd7b3f4f6697911034b70` | [Extrinsic 160,455-1](https://scanner-testnet-v3.portaldot.dev/#/extrinsics/160455-1) |
| Create listing 585886 | `0xb8ed7f04904bd53080fddf341fde1d8bc01a4dfdb88574af6cfd423bb7f82085` | [Extrinsic 165,551-1](https://scanner-testnet-v3.portaldot.dev/#/extrinsics/165551-1) |
| Buy, deposit, claim, unstake | `0x353098afddba251740dcc6f7d39b6a757fc8449d647cbb5ed40666c51e9bf912` | [Extrinsic 165,573-1](https://scanner-testnet-v3.portaldot.dev/#/extrinsics/165573-1) |

Network: Portaldot V3 testnet, EVM chain ID 420420777, `wss://test-node-v3.portaldot.dev`, `https://test-evm-rpc-v3.portaldot.dev`. These are native transactions calling `Revive.call`, so they appear in the [testnet explorer](https://scanner-testnet-v3.portaldot.dev/), not through `eth_getTransactionReceipt` or `eth_getLogs`.

[Verification evidence](docs/VERIFICATION-EVIDENCE.md) records the invariant tests, test coverage, static analysis and the rounding finding they led to. None of this is an audit.

## Technical architecture

Diagram: [docs/architecture.svg](docs/architecture.svg). Design notes: [docs/architecture.md](docs/architecture.md).

| Layer | Technology |
|---|---|
| Blockchain | Portaldot V3 testnet: native Nfts, Assets, NftFractionalization and TransactionStorage pallets, with Solidity running on Revive |
| Contracts | Solidity 0.8.28, built and tested with Foundry |
| Frontend | React and Vite, signing through the Portaldot Wallet or another native injected wallet |
| SDK and API | TypeScript, Polkadot-JS and ethers; a Hono API on Vercel with Vercel Blob for hash-verified document copies |
| Sandbox | The Core v2 bytecode running in the browser on the EthereumJS EVM |

## Smart contracts

| Contract | File | What it does | Status |
|---|---|---|---|
| `PortionCore` | `contracts/src/PortionCore.sol` | Sale, staking, revenue deposits, per-share allocation, claims, operator bond, default and slash | **Deployed on testnet** |
| `CoreTransfer` | `contracts/src/lib/CoreTransfer.sol` | Checked token transfers for Core | Deployed as part of Core |
| `PortionCoreV2` | `contracts/src/candidates/PortionCoreV2.sol` | Core plus escrow, a funding target, reviewer attestation, tranche release, refunds, operator rotation and a time-limited pause | Not deployed: local tests and sandbox only |
| `ControlledFunding` | `contracts/src/candidates/ControlledFunding.sol` | Earlier escrow design | Not deployed |
| `SandboxToken` | `contracts/src/sandbox/SandboxToken.sol` | Pretend payment token for the sandbox | Browser only |
| `Portion`, `Teleport`, `WrappedToken` | `contracts/src/` | Legacy design and bridge source | Not deployed in this release |

Deployment commands are under [Run it](#run-it), and every local step is in [SETUP.md](docs/SETUP.md).

## Demo

- **Live app:** <https://portion-one.vercel.app>
- **Sandbox, no wallet needed:** <https://portion-one.vercel.app/sandbox>
- **Evidence page:** <https://portion-one.vercel.app/evidence>
- **Video (2:56):** <https://youtu.be/rPeJY-nuwrI>, showing the public explorer, a live `verify:chain` run and the sandbox
- **Pitch deck:** [docs/portion-pitch-deck.pdf](docs/portion-pitch-deck.pdf)
- **Test data:** test listing 585886 is a disclosed development test and is sold out, so the sandbox is the way to try a purchase

## Roadmap

**Completed:** Core v1 deployed with a finalized create, buy, deposit, claim and unstake cycle; web app, SDK and API; hash-verified documents and receipts; Core v2 in code, with the sandbox running it.

**Next, in order:** discovery with a real operator; a pilot scope with a stated price; a separate-user browser test; Core v2 on testnet with an external review; then named reviewers and a legal view before any real money.

## Delivery tasks and decisions

The [execution log](docs/planning/TASK-PROGRESS.md) records completed work. The [complete 56-task backlog](docs/planning/MASTER-BACKLOG.md) links to individual GitHub issues, priorities, dependencies and completion checks. The [42 plain-language answers](docs/planning/DECISIONS-AND-ANSWERS.md) explain product, wallet, cost, business and submission decisions and identify what still needs evidence.

## Business direction

Portion aims to become infrastructure for operators who share revenue from productive assets. The reviewed direction is to narrow to operator revenue-sharing administration and keep funding as an optional test module ([why](docs/INVESTMENT-ASSESSMENT.md); [competitors](docs/MARKET-AND-COMPETITORS.md); [cost model](docs/FINANCIAL-MODEL.md), reproduced by `node scripts/financial-model.mjs`; [hackathon evidence map](docs/HACKATHON-EVIDENCE-MAP.md)). No customer, pilot or willingness to pay exists yet. The deployed Core contract charges a 1% sale fee and 0.5% revenue fee in test pUSD. Operator subscription pricing is a hypothesis, not a feature currently charging customers, and the cost model shows the current fixed fees do not cover the cost of serving an operator. The [business plan](docs/BUSINESS.md) records costs, pilot criteria and limits; the app’s Business model page explains what still needs commercial validation.

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

New here? Open the [public preview](https://portion-one.vercel.app), read its [evidence page](https://portion-one.vercel.app/evidence) and follow the [plain-language user and judge walkthrough](docs/WALKTHROUGH.md). Source: [Nailer/portion](https://github.com/Nailer/portion). The public preview reads the real testnet; the Core contract is deployed and its runtime bytecode is verified before actions are enabled. Live pages show no simulated data or fabricated opening balances. The separately labelled [sandbox](https://portion-one.vercel.app/sandbox) uses fictional roles and pretend money, and nothing in it reaches Portaldot. See [hosting scope](docs/HOSTING.md) for what Vercel publishes, and the [pitch deck](docs/portion-pitch-deck.pdf) for the short version.

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
| `npm run verify:chain` | check the deployed contract and its accounting against the source, read-only |
| `npm run contracts:build` / `contracts:test` | compile + export artifacts / Foundry tests, including the invariant suites |
| `npm test` | contract tests + SDK tests |
| `npm run teleport:local` | two-chain bridge test on local anvil |
| `npx tsx scripts/deploy-live-core.ts` | current bounded Core budget check; `--execute` is a separately budgeted write |
| Legacy deploy/bridge/e2e scripts | separate source paths; not instructions to recreate this live Core deployment |
| `npm run typecheck` | all packages |

## Repository layout

```
contracts/       Solidity (Foundry): PortionCore.sol (deployed), src/candidates/PortionCoreV2.sol and ControlledFunding.sol (not deployed), legacy Portion/Teleport/WrappedToken + tests
packages/sdk/    @portion/sdk: addresses, passports, revive, batches, documents, DEX
packages/server/ indexer, document gateway, faucet, keepers, network analysis, relayer
apps/web/        React app (Vite), real chain reads, deployment-gated asset actions and the browser sandbox
scripts/         keygen, deploy, e2e, local Teleport test
docs/            research, architecture, testing, investment assessment, market, cost model, submission pack
deployments/     addresses and evidence written by the scripts
```

See [hackathon readiness](docs/HACKATHON-READINESS.md) for verified requirements and remaining submission work, and [live test results](docs/LIVE-TEST-RESULTS.md) for dated costs and remaining balance. Historical preflights are not current funding requirements.

## Honest limits

- Operator revenue is self-reported. Bond + cadence make non-payment visible and expensive; they do not prove revenue. A production version would add payment-rail attestations.
- In the deployed Core v1 there is no admission, verification or escrow: `create` is permissionless and purchase money is not held for approved spending. Core v2 adds these controls, but runs only in the sandbox and local tests, and is unaudited.
- The recorded lifecycle used one development account as operator and buyer, signed by a script. Separate-user browser signing is not yet witnessed.
- Legacy Teleport source assumes a relayer committee; no live bridge or light-client migration is claimed here.
- `pallet-nfts` lets an item's owner burn it; the proof panel will show "the deed no longer exists".
- Public document copies use verified finalized pins. App receipt history is partial; old/pruned outside transactions require their own recovery/archive path.
- Rounding can credit holders up to one smallest unit too much each time a stake changes, in Core v1 and v2. The extra unit comes from the contract's other balances ([finding C10](docs/VERIFICATION-EVIDENCE.md#finding-c10-rounding-can-over-allocate)). It does not affect the recorded test listing.
- Unaudited testnet software. tPOT and pUSD have no value.

## Team

Sukuna, solo builder: product, contracts and app. Hackathon contact: [DoraHacks](https://dorahacks.io/builder/sukuna), `sukuna` on the Portaldot Discord, or [GitHub issues](https://github.com/Nailer/portion/issues).

## Credits and disclosures

**AI assistance.** AI coding tools, including Claude Code (Anthropic), were used throughout the contracts, SDK, app, tests and documents. Many commits say so with a `Co-Authored-By` line, but those lines are not a complete record. The founder directed the work and is responsible for it.

Built from scratch during the hackathon window (14 Oct – 6 Nov 2026). Third-party code used as dependencies: Polkadot-JS, ethers, React, React Router, Vite, Hono, Vercel Blob (Apache-2.0), Foundry's forge-std (MIT), vitest and, in sandbox mode only, the EthereumJS EVM and utilities (`@ethereumjs/evm` and `@ethereumjs/util` MPL-2.0, `@ethereumjs/common` MIT). Fonts: Inter, Manrope, IBM Plex Mono and Fraunces, from Google Fonts. Demo video narration generated with Kokoro-82M (Apache-2.0).
Research notes cite public repositories from other hackathon teams only to describe the landscape; no code was copied.

## License

MIT. See [LICENSE](LICENSE).
