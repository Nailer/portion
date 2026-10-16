# Portion

**Own a portion of things that earn.** Operators tokenize an income-producing thing (a solar kiosk, an e-bike fleet, a cold room) in one tap. People buy slices and earn when it takes money.
If the operator stops paying, their bond is slashed to the people who hold shares.

Built for the **Portaldot Hacker House 2026**. It targets all four tracks with one product and one SDK:

| Track | What is here |
|---|---|
| **Ecosystem DApps** | The Portion app: market, tokenize wizard, portfolio, native-DEX trading, bond enforcement |
| **Modular Cloud & Middleware** | `@portion/sdk` (dual-VM client), on-chain document gateway with auto-renewal, indexer, open faucet |
| **Node Operations & Tooling** | Network console with a decentralization analysis, Pool Studio, permissionless auto-compound keeper, Prometheus metrics |
| **Multi-Chain & Cross-Chain** | Teleport: pUSD between Portaldot and BNB Chain testnet with a 2-of-3 relayer committee |

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
to deploy or audit. Terms and photo are stored by the chain's own `TransactionStorage`. Secondary trading uses the built-in `AssetConversion` DEX, which had zero pools before this.

See [docs/research.md](docs/research.md) for the ecosystem research and why this idea, [docs/architecture.md](docs/architecture.md) for the design,
and [docs/TESTING.md](docs/TESTING.md) for how to check every claim.

## Run it

Requirements: Node 22.13+, and [Foundry](https://getfoundry.sh) only if you want to rebuild or test the contracts.

```bash
npm install
npm run dev            # API on :8787, web on :5173
```

- <http://localhost:5173> uses the live Portaldot V3 testnet.
- <http://localhost:5173/?demo> is a clearly labelled simulation that follows the contract's rules, for when the testnet is unreachable.

To deploy your own instance:

```bash
npm run keygen         # writes .env (git-ignored) and prints the deployer address
# fund that address on the testnet
npm run deploy && npm run seed && npm run e2e
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | API + web app |
| `npm run contracts:build` / `contracts:test` | compile + export artifacts / Foundry tests |
| `npm test` | contract tests + SDK tests |
| `npm run teleport:local` | two-chain bridge test on local anvil |
| `npm run deploy` · `deploy:bnb` · `seed` · `e2e` | live deployment, seeding and evidence |
| `npm run typecheck` | all packages |

## Repository layout

```
contracts/       Solidity (Foundry): Portion.sol, Teleport.sol, WrappedToken.sol + tests
packages/sdk/    @portion/sdk: addresses, passports, revive, batches, documents, DEX
packages/server/ indexer, document gateway, faucet, keepers, network analysis, relayer
apps/web/        React app (Vite), including a simulated mode that mirrors the contract
scripts/         keygen, deploy, seed, e2e, local Teleport test
docs/            research, architecture, testing, submission pack
deployments/     addresses and evidence written by the scripts
```

## Honest limits

- Operator revenue is self-reported. Bond + cadence make non-payment visible and expensive; they do not prove revenue. A production version would add payment-rail attestations.
- Teleport v0 trusts a relayer committee. Portaldot already produces BEEFY/MMR commitments, which is the planned path to a light-client bridge.
- `pallet-nfts` lets an item's owner burn it; the proof panel will show "the deed no longer exists".
- The public RPC node prunes old blocks, so the document gateway indexes live and also accepts verified pins.
- Unaudited testnet software. tPOT and pUSD have no value.

## Credits and disclosures

Built from scratch during the hackathon window (14 Oct – 6 Nov 2026). Third-party code used as dependencies: Polkadot-JS, ethers, React, Vite, Hono, Foundry's forge-std (MIT), vitest.
Research notes cite public repositories from other hackathon teams only to describe the landscape; no code was copied. Licensed MIT.
