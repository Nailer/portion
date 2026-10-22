> Current status: contracts are undeployed. This is a submission plan, not evidence of live asset transactions. Runtime simulation and seeded example businesses have been removed.

# Submission pack

## Dates that matter (from the DoraHacks page)

| Date (UTC) | What | Status |
|---|---|---|
| 14 Oct | Build window opens | open |
| **24 Oct 12:00** | **Check-in**: public repo, README, architecture diagram, testnet contract address + tx hash, demo link or ≤3 min video | needs live deployment |
| 27 Oct 12:00 | Office-hour applications | optional |
| **6 Nov 04:00** | **Final submission / code freeze** | |
| 8–9 Nov | Live demo day (Discord) | |
| 9–10 Nov | Community Choice voting | |

Rules that shape how we work: ≥3 commits in the window (we have many), no core module committed for the first time in the last 24 hours, repo public, code mostly written in the window, third-party code disclosed.

## What you need to do (I cannot do these)

1. **Register** on the DoraHacks page (button *Register*). Use the native address `5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4` when it asks for a POT address, if it does.
2. **Get testnet tokens.** Open a ticket in the Portaldot Discord (https://discord.gg/portaldot):

   > Hi, I'm registered for the Portaldot Hacker House 2026 (DoraHacks, team Portion). My native POT address is `5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4`. I need about 2,000 tPOT to deploy my project: the contracts take a refundable storage deposit of roughly 0.06 tPOT per byte of code, about 1,450 tPOT for the three. Screenshot of my registration attached.

   Smaller fallback: ~1,100 tPOT deploys Portion alone; Teleport needs ~470 more.
3. **BNB testnet gas** for the cross-chain track: send ~0.05 tBNB from https://www.bnbchain.org/en/testnet-faucet to the *EVM ops account* printed by `npm run keygen`.
4. **Publish the repo** (public GitHub). I have not pushed anything. When you are ready:
   ```bash
   cd /Users/aje/Documents/Github/portion
   gh repo create portion --public --source=. --push
   ```
5. Record the video and submit on DoraHacks (script below).

## DoraHacks form copy

- **Project name:** Portion
- **One-sentence overview:** Tokenize an income-producing thing in one tap and let anyone own a portion of it, with a bond that pays holders if the operator stops paying, built from Portaldot V3's native modules and Solidity in a single atomic transaction.
- **Track:** Ecosystem DApps (primary). The repo also ships a middleware SDK and gateway, a node-operations console with Pool Studio, and a cross-chain bridge.
- **Why Portaldot is essential:** native assets are ERC-20s through `AssetsPrecompiles`, `NftFractionalization` gives protocol-locked deeds with fixed share supply, `TransactionStorage` keeps the paperwork on-chain, `AssetConversion` is a ready-made DEX, and `Utility.batchAll` lets one signature span all of it plus a Solidity call. None of that exists on a plain EVM chain.

## Self-assessment against the judging criteria

| Criterion | Evidence in the repo |
|---|---|
| **Technical feasibility 30%** | 43 Foundry tests with a solvency fuzz; SDK tests; a two-chain bridge test; live read-only tests against the V3 runtime; `npm run e2e` writes block and extrinsic hashes to `deployments/e2e-report.md`; commit history |
| **Innovation 30%** | atomic native + EVM batch; shares as native assets seen as ERC-20; protocol-locked deed; operator bond enforced by a permissionless slash; on-chain documents; keepers; a Passport that hides address mapping |
| **Ecosystem contribution 20%** | an open faucet (the chain had none), a dual-VM SDK, a network analysis that tells the chain what is wrong with it (2 validators, 0 nominators), Pool Studio, Prometheus metrics, native DEX and storage in real use, a reference for composing native modules |
| **Business potential 20%** | 1% primary-sale fee and 0.5% revenue fee already in the contract; clear user (small operators with equipment, people who chip in); path from testnet to mainnet in the Foundation's support programme; roadmap below |

## Demo video script (≤ 3:00)

| Time | Show | Say |
|---|---|---|
| 0:00 | Home, the portion wheel | "Portion lets you own a portion of things that earn. Drag the wheel to choose how much." |
| 0:15 | Listing page: proof panel, operator clock | "Every listing shows three proofs: the paperwork is stored on the chain, the deed is locked, and a bond backs the operator's promise." |
| 0:40 | Buy 10 shares → the Under-the-hood sheet → confirm | "One tap. These are the real calls: a native approval and a Solidity purchase, atomic." |
| 1:00 | Tokenize: fill the form, show the nine steps, publish | "An operator lists in one signature: mint a deed, split it into shares, store the terms, register in Solidity. This transaction does not exist on a plain EVM chain." |
| 1:40 | Portfolio: claim revenue | "Revenue streams to holders pro rata and is claimed in one tap." |
| 1:55 | The two-minute listing: clock turns red, keeper slashes | "If the operator stops paying, anyone can slash the bond, and our keeper does it automatically." Show the slash in the keeper log. |
| 2:20 | Network console: findings | "For node operators: the chain has two validators and no nominators. Portion says so, and Pool Studio lets anyone fix it." |
| 2:40 | Teleport and the faucet, block explorer link | "Bridge pUSD to BNB Chain, and an open faucet for every builder. Portion is a front door for Portaldot V3." |

Record against the **live** testnet after creating a testnet listing from actual operator-supplied details, and show a block explorer link for one transaction.

## Pitch deck outline (PDF, 7 slides)

1. **Problem** — small operators own things that earn but cannot raise against them; investors cannot verify anything. Chains have a 2-validator security story and no apps.
2. **Why Portaldot** — the 70-module runtime nobody uses; the atomic native + EVM transaction (the diagram from `docs/architecture.svg`).
3. **Product** — the three proofs and the one-tap listing (screenshots).
4. **Proof it works** — contract address, tx hashes, test counts, e2e report.
5. **Ecosystem contribution** — faucet, SDK, network analysis, Pool Studio, Teleport.
6. **Business** — fees, users, distribution loop (operators bring investors, investors bring operators), what mainnet needs.
7. **Why keep supporting us** — roadmap and the honest limits.

## Roadmap

1. Payment-rail attestations so revenue is evidenced, not only reported.
2. Replace the Teleport relayer committee with a BEEFY/MMR light client.
3. A second asset class: validator hardware shares that pay out natively from staking rewards.
4. Operator reputation derived from on-chain punctuality across listings.
5. ink! (WASM) port of the registry to run on both VMs.
