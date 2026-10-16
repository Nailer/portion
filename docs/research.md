# Portaldot Hacker House 2026 — research, idea portfolio, decision

> Written 16 Oct 2026, day 3 of the build window (14 Oct – 6 Nov). Everything marked **[verified]** was
> checked directly against the live Portaldot V3 testnet or the official hackathon page. Everything marked
> **[inferred]** is my reading of that evidence. Background knowledge about other ecosystems is marked **[background]**.

---

## 1. Hackathon thesis

Portaldot Network V3.0 is a Polkadot-SDK runtime that now runs **both** EVM bytecode and WASM (ink!) contracts. The Foundation
wants proof that V3 is a real application platform, not another EVM clone, and it wants builders who will stay after the prize money
is paid (the page spends more words on the *post-hackathon support program* than on the prizes).

Prize pool is small (5,200 USDT, half paid in POT), so the real prize is **ecosystem support**: mainnet launch help, subsidies,
gas rebates, liquidity incentives, official listing. Judges grade on evidence: GitHub commit cadence, testnet transactions,
contract addresses, live demo.

## 2. What the sponsor actually wants

Evidence from the page **[verified]**:

| Signal | What it says |
|---|---|
| Weighting: Tech 30 / Innovation 30 / Ecosystem 20 / Business 20 | They want working software *and* a reason for it to exist. |
| "Verifiable on-chain interactions", "commit timeline", "no big-bang commit in last 24h" | They have been burned by fake demos and last-minute dumps. |
| "Effective use of V3.0 features such as WASM/EVM compatibility, modular architecture, multi-chain" | Showcase V3 specifically. |
| Support program: *gas fee rebates, liquidity support, user conversion incentives, onboarding campaigns, RWA data mapping, Oracle/data synchronization* | They want **users, transaction volume, RWA, data** — not tooling for its own sake. |
| 4 tracks, but DApps has 3 prize slots (800/500/300) vs 1 elsewhere | Applications are what they want most. |
| Intro docs: "Layer0 for physical industries", RWA tokenization platform, cross-chain data | Their own story is real-world assets and data. |

## 3. Strategic ecosystem objectives

If this hackathon succeeds spectacularly, six months from now the Foundation wants people saying:
**"Portaldot V3 is where real-world assets live, and it's easy to build on."** Concretely:

1. A flagship application that uses V3's native capabilities, not just a Solidity contract that could run anywhere.
2. Developer onboarding that works (the current path is: dead endpoints, no faucet, no explorer for Solidity, dual-address confusion).
3. Recurring on-chain activity from real users, not one-off demo transactions.
4. A credible answer to "what is special about V3?".

## 4. Competitive landscape [background + verified]

| Ecosystem | Does better | Lesson for Portaldot |
|---|---|---|
| Polkadot Hub (same `pallet-revive` stack) | Mature tooling, explorers, faucet, funding | Portaldot's differentiator must be the *runtime's native modules* + a focused vertical, not "we also run Solidity". |
| Astar / Moonbeam | Dual-VM story, wallets | The dual-VM pitch is not new; *composition* of native modules from contracts is. |
| Centrifuge | RWA on a Substrate chain | RWA is a proven category on this architecture, but they built bespoke pallets. Portaldot already ships the generic ones. |
| Hydration / Acala | Native DEX, stablecoins | Native AMM pallet (`AssetConversion`) is a real DEX with zero extra contracts. |
| Bifrost | Liquid staking | Nominated PoS invites staking products. |
| Bulletin / IPFS-on-chain | Storage pallets | `TransactionStorage` gives chain-guaranteed data retention. |
| Ethereum L2s (Base, Arbitrum) | Distribution, wallets, consumer apps | Where users already are; Portaldot needs to be reachable from there. |
| BNB Chain | POT itself (a BEP-20, 20M supply) lives here | Any liquidity story crosses this bridge. |

What users complain about **[verified from the three other repos already in the hackathon + the official guide]**:
- endpoints die during upgrades (PortalPulse recorded 502s on 9 Oct), no faucet (tokens only to registered participants), no Solidity explorer,
- the H160 you derive from a key differs from your MetaMask address; you must fund the *mapped Substrate account*,
- decimals are 14 not 18, gas limits need a dry run first, ink! needs pinned toolchains.

## 5. Ecosystem weaknesses

- **Ghost town**: 2 validators, 0 DEX pools, 0 nomination pools, 2 assets (both team-created), no known apps **[verified on chain]**.
- **Onboarding is hostile** (see above).
- **Trust anchor is tiny**: with 2 validators, finality needs both; any security story must be honest about that.
- Mainnet runs an old 2021 runtime; V3 is testnet-only for now **[verified]**.

## 6. Underused ecosystem strengths  ← the key finding

I dumped the live runtime metadata **[verified]**. V3 is a *full* Polkadot-SDK runtime with ~70 modules. Almost no hackathon team will touch
them, because the official quickstart is "deploy a Storage contract from Remix". The ones that matter:

| Native module | Why it is surprising on an "EVM chain" |
|---|---|
| `AssetsPrecompiles` | **Every native asset is automatically an ERC-20** at a deterministic address. I confirmed `symbol()` on asset 1 returns `TST`. No token contract to deploy, no audit surface. |
| `AssetConversion` | A built-in Uniswap-v2-style AMM. Pool setup fee 1 tPOT, 0.3% LP fee. **Zero pools exist.** |
| `Nfts` + `NftFractionalization` | Turn an NFT into N fungible shares in one call; the NFT is locked; whoever re-collects 100% of shares can `unify` it back. **Trustless fractional ownership with no contract.** |
| `TransactionStorage` | 32 KiB per transaction, retained 100,800 blocks (~7 days), renewable, fee ≈ nothing. Chain-guaranteed data availability. |
| `NominationPools` | Native pooled staking with permissionless auto-compound (`bondExtraOther`). Zero pools exist. |
| `Utility.batchAll` | **One signature, many modules, atomic** — including `Revive.call` into Solidity. |
| `Oracle`, `MetaTx`, `Recovery`, `Proxy`, `Multisig`, `Scheduler`, `Beefy`+`Mmr`, `Lottery` | Oracle feeds, gasless meta-tx, social recovery, scoped delegation, light-client proofs. |

Sponsor's own description of V3 says "EVM + WASM". The runtime says more: **EVM + WASM + 60 native modules reachable from the same transaction.**

## 7. Obvious Idea Graveyard

Based on what is already visible on GitHub for this event (explorer `potscan`, monitor `PortalPulse`, oracle `tidemark`) and on what any 122-person
DoraHacks field reaches for first:

| Category | Why people build it | Typical implementation | What would make it interesting again |
|---|---|---|---|
| Block explorer / Solidity explorer | Obvious pain, listed in the guide | Indexer + React table | Not a table: something that *explains* a transaction across the EVM and native layers. Already taken by potscan. |
| Node monitor / uptime | "Node Operations" track name | Prometheus-style dashboard | Must do something *to* the network (auto-compound, pool creation), not just display it. Taken by PortalPulse. |
| Price oracle | "Middleware" track | N reporters → median contract | Native `Oracle` pallet makes custom oracles redundant. Taken by tidemark. |
| Token bridge | "Cross-chain" track | Lock/mint + trusted relayer | Needs a *reason* to cross: a product that lives on both sides. |
| Fractional real estate | "RWA" in the track text | ERC-721 → ERC-20 wrapper contract, fake photos | Native fractionalization + on-chain documents + an enforcement mechanism for the operator. |
| DEX / lending / yield clone | "DeFi" in the track text | Solidity AMM copy | Native AMM already exists; a clone is a worse version of a built-in. |
| Generic wallet | Dual-address pain | MetaMask wrapper | Only interesting if it *removes* the pain invisibly. |
| AI agent anything | Fashion | Chatbot calling a contract | Skip. |
| NFT marketplace | Muscle memory | OpenSea clone | Skip. |
| Quest / airdrop campaign tool | Foundation mentions campaigns | Task list + points | Legitimate, but reputation-flavoured and weak on-chain. |

## 8. Gap Map

**Missing** — liquid markets for anything (0 DEX pools); a faucet; any retail-facing app; a way to buy POT-adjacent assets from BNB Chain.

**Broken** — onboarding (address mapping, 14 decimals, dry-run gas), endpoint reliability, Solidity visibility.

**Newly possible** — *native asset = ERC-20 for free*; *NFT → shares → AMM listing, all native*; *atomic native+EVM transaction*; *on-chain documents with guaranteed retention*.

**Misunderstood** — V3 is being treated as "EVM + WASM". It is a **composition engine**: one extrinsic can create an NFT, fractionalize it, store its legal documents, open a DEX pool and register it in a Solidity contract. Nobody will demo that.

## 9. Important primitives

1. Atomic `batchAll` across native pallets and `Revive.call`. 
2. ERC-20 view of native assets (`AssetsPrecompiles`).
3. `NftFractionalization` (locked deed + fixed supply).
4. `TransactionStorage` (chain-backed documents).
5. `AssetConversion` (native AMM).
6. `NominationPools` + permissionless compound (native automation hook).
7. `pallet-revive` address mapping (`AutoMap`) — a pain point *and* an opportunity to hide.
8. `Beefy` + `Mmr` (light-client proofs; 2 authorities active).

## 10. Behaviours worth targeting

- People already buy small slices of things that earn: savings clubs, crowdfunding, "chip in" purchases, equipment shares among traders, farm co-ops.
- Small operators (kiosk owners, machine owners, tuk-tuk/bike fleets, cold rooms) have assets but no cheap capital and no credible way to prove revenue.
- Investors want *proof the thing exists* and *a mechanism that punishes non-payment*.
- Everyone hates "fund the mapped address, convert decimals, estimate gas".

## 11. Concept portfolio (14)

Shortlisting notes in brackets.

1. **Portion** — own a portion of things that earn. NFT deed → locked → shares → native DEX; Solidity vault pays revenue; operator bond slashes on missed payments. **[chosen]**
2. **Autopilot** — decentralized keeper network + task registry; scoped `Proxy` delegation for native actions. [strong infra, weak demo, good as a *module*]
3. **Ajo** — rotating savings circles with stablecoin pots and fair random payout order. [best consumer behaviour, but does not need V3]
4. **Portal Passport** — derive a Substrate account from a MetaMask signature, hide mapping entirely, sponsor first gas. [too small alone; becomes Portion's identity layer]
5. **Portal Faucet** — the missing faucet with address mapper. [becomes a Portion module]
6. **Portal Missions** — verifiable onboarding quests that teach V3 by doing. [Foundation would use it; reputation-flavoured]
7. **Teleport** — BNB Chain ↔ Portaldot asset bridge with relayer quorum. [needed for the Cross-Chain track; becomes a module]
8. **BEEFY Lens** — verify Portaldot state on any EVM chain from its BEEFY commitments. [most technically impressive; heavy; stretch]
9. **Validator Shares** — fractionalize validator hardware income. [needs runtime access we do not have]
10. **Pool Studio** — one-click nomination pool creation + auto-compound keeper. [becomes the Node-Ops module]
11. **Deadman** — inheritance via `Proxy` delay + `Recovery`. [lovely, tiny]
12. **PotDrive** — decentralized file locker on `TransactionStorage` with renewal keeper. [becomes Portion's document layer]
13. **Gasless Lane** — `MetaTx` + pay-fees-in-asset sponsorship. [infrastructure; unverified on this runtime]
14. **Dividend Tags** — NFT receipts that carry live revenue entitlements. [subsumed by #1]

## 12. Combination engine

- **Fractionalization** + **TransactionStorage** + **bond/slash** → *an RWA listing that proves it exists and can be punished* = Portion's core.
- **Passport** + **Faucet** + **sponsored first transaction** → a zero-token user can transact in 20 seconds = Portion's front door.
- **NominationPools** + **permissionless compound** + **keeper** → the only product that actually *helps* a 2-validator network = Portion's Node-Ops module.
- **Teleport** + **Portion** → investors holding stablecoin on another chain can fund a listing = Portion's Cross-Chain module.
- **PotDrive keeper** + **SDK** → Portion's Middleware module (storage gateway, dual-VM SDK, indexer API).

## 13. Five deep dives (condensed)

### A. Portion (chosen)
- **Thesis**: tokenizing an income-producing real thing should take one tap, and the investor should be able to verify it exists and see the operator punished if they stop paying.
- **Flow**: operator fills a form and uploads a photo → one signature → *atomic* transaction: mint deed NFT, fractionalize into N shares, store photo+terms on-chain, register in the Solidity registry, open an offering, post bond. Investor buys shares with stablecoin, shares auto-stake in the vault, weekly revenue deposits stream pro-rata, claim in one tap. Shares trade on the native DEX.
- **Why V3**: native assets as ERC-20, locked-deed fractionalization, on-chain docs, native AMM, atomic batch with Solidity.
- **Business**: 1% primary-sale fee + 0.5% revenue fee; operator-facing SaaS later.
- **Weakness**: real-world revenue is self-reported. **Fix**: bond + cadence enforcement + on-chain punctuality score; disclose plainly; later, oracle-attested or payment-rail-linked revenue.

### B. Autopilot
Keeper registry with staked operators, cross-chain triggers. Good as middleware; demo is "a payment happened on time", which is not memorable. Kept as concept only.

### C. Ajo
Best consumer loop (group chat virality, weekly recurring transactions). Fails the "why this ecosystem" test: any L2 does it. Kept as roadmap idea for the same SDK.

### D. BEEFY Lens
"Verify Portaldot on any chain without trusting a relayer." Real technical novelty; with only 2 validators the economic meaning is thin, and finality gadget participation is unverified. Stretch goal after the bridge.

### E. Pool Studio
Native pooled staking is unused. Small but directly addresses the decentralization problem. Included as a module.

## 14. Adversarial judge review (tired judge, submission #151)

| Question | Honest answer for Portion |
|---|---|
| Seen this already? | Fractional RWA, yes. Fractional RWA built from *native* NFT-fractionalization + native AMM + on-chain docs + atomic native/EVM batch, no. |
| What is novel? | The composition and the enforcement mechanism (bond slashing on missed cadence), not the category. |
| Why this sponsor? | The atomic cross-module transaction and native-asset-as-ERC-20 exist because of this runtime. Remove Portaldot and the app collapses into a worse EVM clone. |
| Product or demo? | Has an operator side, an investor side, a keeper that does real work, a faucet other builders can use. |
| Would anyone use it? | Small operators with equipment and people who chip in. Plausible; real revenue verification is the open risk and is disclosed. |
| Can they prove it works? | Contract addresses, tx hashes, a CLI end-to-end script (`npm run e2e`) and an "Under the hood" panel showing the exact batch for every listing. |
| What will I remember tomorrow? | "One tap created an NFT, shares, a document, a registry entry and a sale — and the app showed me the 9 calls inside it." |
| Magic moment? | Click **Tokenize** once; watch nine steps tick through in a single transaction. |

Changes forced by the review: (1) add the bond/slash mechanism instead of trusting operators; (2) add the "Under the hood" view so judges can *see* V3; (3) add the sponsored-first-gas flow so a judge with zero tokens can try it; (4) cut governance, token, AI, social.

## 15. Wildcards

1. **Deadman** — your funds go to someone you trust if you stop checking in, using only `Proxy` delay and `Recovery`. No contracts. Most people would not think of pallets as a product.
2. **The Validator Pool Thermostat** — a keeper that watches validator performance and *re-nominates a pool* away from underperformers. Governance-by-automation of network security.
3. **Document Weather** — a public archive where anything stored on-chain shows a "retention forecast" and is auto-renewed by anyone who tips the keeper; the chain's retention rule becomes a game of collective preservation.

## 16. Final synthesis

- **Unusually promising**: anything that composes native modules with Solidity in one transaction; RWA with enforcement; automation that touches native staking.
- **Overcrowded**: explorers, monitors, oracles, bridges, generic DeFi, wallets.
- **Surprises**: (1) native assets are already ERC-20s; (2) the chain ships an AMM and staking pools nobody has used; (3) the chain allows 32 KiB of guaranteed-retention data per transaction for effectively zero cost; (4) the official docs describe none of this.
- **Most underexploited capability**: `Utility.batchAll` across `NftFractionalization`, `TransactionStorage`, `AssetConversion` and `Revive` — a transaction shape that does not exist on any EVM chain.

## Decision

Build **Portion** as a four-module platform so it speaks to every track with real functionality:

| Track | Module | What it does |
|---|---|---|
| Ecosystem DApps | **Portion app** | Tokenize, buy, trade, earn. |
| Modular Cloud & Middleware | **`@portion/sdk` + gateway/indexer API** | Dual-VM client that hides address mapping, atomic batch builder, on-chain document gateway with auto-renew. |
| Node Operations & Tooling | **Network Console + Pool Studio + compound keeper** | Validator health, decentralization analysis, create/join pools, permissionless auto-compound. |
| Multi-Chain & Cross-Chain | **Teleport** | BNB Chain ↔ Portaldot stablecoin bridge so investors can fund listings from where they already hold money. |
