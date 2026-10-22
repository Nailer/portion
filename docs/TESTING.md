# How to check Portion

There are four ways to check it, from "no setup" to "on-chain evidence".

## 1. Click through it (2 minutes, no setup)

```bash
npm install
npm run dev          # starts the API on :8787 and the web app on :5173
```

Open <http://localhost:5173/?demo> for the **simulated** mode, which follows the same rules as the Solidity contract and needs no network. Then:

1. Click **Get started → Explore as a funder**, or select **Operator/Funder** in the simulation banner. No wallet or recovery phrase is needed.
2. Open **Solar charging network**. Drag the wheel, press **Buy**. Read the "Under the hood" sheet: those are the real calls (a native approval, then a Solidity call). Confirm.
3. Open the **Podcast network catalogue**: its operator clock is in the "Late" band. Press **Skip a week ahead** in the banner and it becomes slashable; then press **Slash the bond** and watch the bond flow to holders.
4. **Tokenize**: fill the form, watch the preview card and the nine-step "Under the hood" list, publish.
5. **Portfolio**: claim, stake, see activity.

Use **Use the live testnet** or open `?live` to inspect the live network. The public build defaults to simulation; removing `?demo` alone does not change a saved mode choice. Live native signing uses a compatible browser extension, not a phrase imported into the site.

## 2. Automated tests (no network)

```bash
npm run contracts:test      # Original and compact-core contract suites, including solvency fuzzing
npm test -w @portion/web    # UI, wallet-connection and simulation regression tests
npm test -w @portion/sdk    # Address mapping, signer routing, units, development keys and hashing
npm run teleport:local      # two local EVM chains + the relayer: both directions, replay and forgery rejected
npm test -w @portion/server # Faucet recipient safety and spending opt-in tests
npm run typecheck           # scripts, sdk, server and web
```

## 3. Read-only checks against the real testnet (no tokens needed)

```bash
LIVE=1 npm test -w @portion/sdk
```

These prove, against the live V3 runtime, that: the runtime is `portaldot-v3`; our SS58 → H160 rule equals `reviveApi.address`; our fallback account rule equals `reviveApi.accountId`;
and a native asset answers as an ERC-20 through `ReviveContract.read` (asset 1 → `TST`).

Also useful:

```bash
npm run deploy:check:core   # read-only core/full budget and runtime snapshot in deployments/preflight.*
curl localhost:8787/api/network | jq .findings    # live security analysis of the chain
curl localhost:8787/metrics                       # Prometheus gauges for node operators
```

## 4. On-chain evidence (needs a funded deployer)

```bash
npm run keygen              # once: creates .env with keys and prints the deployer address
# fund the printed SS58 address with ~2,000 tPOT (see the Portaldot Discord ticket flow in docs/SUBMISSION.md)
npm run deploy              # pUSD, deeds collection, Portion, Teleport  → deployments/portaldot-testnet.json
npm run seed                # liquidity, three listings with history, one DEX market
npm run e2e                 # a full lifecycle with fresh accounts → deployments/e2e-report.md (block + extrinsic hashes)
npm run e2e -- --slow       # also waits out a 2-minute cadence and proves the bond slash
```

For the BNB side of Teleport:

```bash
# fund EVM_OPS_KEY (printed by keygen) with ~0.05 tBNB from the BNB testnet faucet
npm run deploy:bnb
```

## What each check proves

| Claim | Where it is proven |
|---|---|
| Revenue is split pro-rata and the vault never over-pays | `contracts/test/Portion.t.sol` (`testFuzz_vaultSolvency`, pro-rata and late-joiner tests) |
| A defaulted operator's bond goes to holders, with a keeper tip | `test_slash_*`, and `npm run e2e -- --slow` on the live chain |
| The bridge rejects replays, forged and unsorted signatures, over-cap transfers | `contracts/test/Teleport.t.sol`, `npm run teleport:local` |
| Both bridge directions conserve supply | `npm run teleport:local` |
| Address mapping and precompile addressing match the real runtime | `LIVE=1 npm test -w @portion/sdk` |
| The listing batch works on the real runtime | `npm run e2e` (needs funds) |

## Known gaps in verification

- The native-module batch (`Nfts`, `NftFractionalization`, `Assets`, Solidity) has been built against the live runtime's metadata and every call signature was read from it,
  but it can only be *executed* once a funded account exists. `npm run e2e` is the test for that.
- The Teleport relayer has been tested against local EVM chains. Its use of Portaldot's `eth_getLogs` and `eth_sendRawTransaction` is untested until deployment.


## Operator and funder walkthrough (Stage 3)

Open http://localhost:5173/operator?demo. Choose **Operator** in the simulation banner. Either use **Create demo solar asset** or **List a new asset → Fill with the demo solar example** and review all four steps. After publishing, open the asset and switch to **Funder**. Buy 10 shares, close the receipt, then switch back to **Operator** and open **Workspace**.

Review and pay 20 pUSD from the workspace. Switch to **Funder → Portfolio**, review a claim for 19.9 pUSD and confirm. Cash should be 1,919.9 after the original 100 pUSD purchase and the claim; pending income should be zero. The operator receives 99 from the sale, pays 20 in revenue and retains a 50 bond in the contract. This is simulated activity only.

Use in-app links while testing: reloading resets the in-memory assets and demo accounts.
