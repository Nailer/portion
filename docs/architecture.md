# Current Core architecture — 24 October 2026

![Current deployment and money-flow boundaries](architecture.svg)

## Deployed components

| Component | Responsibility and boundary |
| --- | --- |
| Browser + injected native wallet | Public browsing, current chain reads, hash checks and reviewed native signing. Wallet retains keys; no generated visitor identity or recovery-phrase form. |
| Portaldot native modules | NFTs, fractionalized native share assets, approvals, native/contract address mapping, top-level transaction document storage and atomic utility batching. Native tools are separate from the primary funding flow. |
| Deployed PortionCore.sol | Configured test-pUSD token; primary purchase, earning stake, deposited-revenue accounting, bond, cadence, default and closure rules. **Purchase proceeds go directly to the operator; no funding-release escrow exists.** |
| @portion/sdk Core adapter | Versioned ABI, immutable document schema, transaction plans, flat account-mapping batches, amounts/decimals, receipt parsing and read/dry-run helpers. Some batched calls use bounded fallback limits where earlier calls are needed for simulation. |
| Vercel API + Blob | Verify finalized document/creation/action receipts, retain hash-matching public copies and app-published history. This is not a complete archive or a physical-asset verifier. |
| Separate test-credit issuer | Limited explicit pUSD grants using its own funded service key. Native grants disabled; deployment key not hosted. |

Core: `0x17501f4510ba4298b618209e105cd47036509706`, native payment asset **4217**, testnet chain ID **420420777**. See `deployments/portaldot-testnet.json` for deployment block/hash and runtime identity. Legacy Portion.sol/Teleport.sol, relayers, complete SQLite indexing and automatic keepers are source/roadmap components, not the current hosted release.

## Asset creation

1. Allocate native asset/item identifiers before hashing the terms. Build immutable terms referring to those actual identifiers and the cover hash.
2. Review and sign each top-level `TransactionStorage.store` separately. Verify accepted finalized stores and pin hash-matching public copies.
3. Review/sign one flat native batch: NFT mint → raw 32-byte document hash attribute → fractionalize → share approval → bond approval → Core `create`. Required native account mapping can be prepended; nested utility batches are avoided.
4. Core checks declared supply and numerical terms, escrows offered shares and the bond, and emits Listed. It does not independently inspect physical equipment or require the web's native-backing proof from a direct external caller.
5. Publish catalog/activity only after verifying the successful finalized receipt and matching terms. Failed public publication is retried without duplicating the successful chain creation.

The SDK/application limits accepted documents to 32 KB; this is not a claim that every current runtime constant equals that application limit. Native retention is finite. Hosted verified copies aid access; backup/restore remains an operational task and no automatic renewal keeper is promised.

## Share and native-deed checks

Native assets are accessible through the runtime's ERC-20 precompiles. The proof checks the deed, NFT-to-asset mapping, fraction/current supply and pallet-controlled roles. Fractionalization's runtime Locker blocks transfer even if the explicit ItemSettings flag is zero: a signed historical read-only transfer check returned nfts.ItemLocked before the optional admin lock on our test deed. Requiring collection-Freezer-only lockItemTransfer in every user's flow would be incorrect.

Native token proof is not physical/legal title or independent operator verification. Burn/redemption and external-caller boundaries remain part of the adversarial review. See [FUNDING-PROTECTION.md](FUNDING-PROTECTION.md).

## Current money flow

- `buy`: purchase price minus 1% goes directly to the operator; fee goes to the treasury; bought shares are credited as earning stake.
- `deposit`: the submitted payment enters Core; 0.5% goes to the treasury and the rest is allocated pro rata to current earning stake. It does not automatically capture business income.
- `claim`: holder initiates transfer of their earned deposited allocation to their wallet.
- `slash`: a submitted transaction in default allocates the limited bond according to stake and caller-tip rules. No hosted autonomous slasher exists. A bond does not cover arbitrary losses or force actual equipment procurement.
- `unstake`: returns share tokens, not purchase principal. A secondary sale needs an actual buyer/pool; liquidity is not guaranteed.

Contract accounting, native restrictions, web evidence and real-world agreements are distinct trust boundaries. A complete funds-management product would require a reviewed controlled-release/collection design not implemented by this Core version.

## Closing and security boundaries

Core guards reentrancy and tracks stake/claim accounting. New buy/stake participation is blocked after default. Wind-down requires zero stake and settlement of an overdue remaining bond; bond withdrawal then has a delay. These are limited on-chain rules, not a complete legal/default recovery mechanism.

The app checks genesis, configured contract/runtime code and payment asset; transaction outcomes are finalized-only. Partial uploads and unknown tracking outcomes require explicit recovery. No independent security audit, legal approval, protected investment product or complete separate-user browser proof is claimed. [Current evidence](LIVE-TEST-RESULTS.md) and [open tasks](planning/MASTER-BACKLOG.md) record the distinction.
