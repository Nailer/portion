> Current status, 23 October 2026: Core is deployed. The live release and current supported flow are documented in [LIVE-CORE-RELEASE.md](LIVE-CORE-RELEASE.md); this supersedes earlier undeployed-status notes below.

# Smaller funding contract — stage 7, 22 October 2026

## Decision

The published app now uses real chain reads only, with undeployed asset actions blocked. `PortionCore.sol` is a tested budget candidate, not a deployed replacement and not wired into the SDK or UI. Do not deploy it merely because its storage deposit is below 500 tPOT: setup, storage growth, fees and working balances also need room.

## What changed

The existing `Portion` contract stores display strings and provides aggregated listing/portfolio reads and configurable administration. The candidate keeps the money-accounting functions and references one hashed listing document. Native asset IDs identify listings; names, descriptions, images and NFT references must be resolved from the document/native records by a future SDK/indexer adapter. This does not weaken the requirement to verify document bytes against their hash.

The candidate uses one payment asset and treasury for the whole deployment, with no setters. Sale fees are fixed at 1%, revenue fees at 0.5%, minimum bond at 5% of the offering (and nonzero), minimum cadence at 60 seconds, and slash caller compensation at 1%. This is a narrower configuration model, not feature parity with every legacy administrative option.

Retained: share-supply check and sale escrow; primary funding with automatic staking; external-share staking and unstaking; allocation to current stakers; late-joiner isolation; claiming earned income; operator-only qualifying deadline resets; bond top-ups and default penalties; unsold-share returns; restrictions on closing with active stakes or an unsettled default; delayed bond withdrawal; retained claims after unstaking/closure; and reentrancy guards.

Not retained as contract-level conveniences: names/summary/cover strings, listing/position pagination, configurable fee/rule administration, separate payment tokens per listing, revenue memo, and cumulative deposit/strike counters. Document resolution and event indexing must supply the relevant display/history information. The current contract does not independently verify physical equipment, enforce legal ownership, or guarantee purchase-principal repayment; the candidate does not add those capabilities.

## Measured comparison

Both constructors passed read-only simulations on Portaldot V3 spec 3002. The wallet had 500 tPOT, nonce 0, at finalized block 145122.

| Item | Existing Portion | Candidate PortionCore |
|---|---:|---:|
| Creation bytecode | 11,738 bytes | 6,143 bytes |
| Runtime bytecode | 11,504 bytes | 5,853 bytes |
| Estimated storage deposit | 925.788 tPOT | 481.1685 tPOT |
| Estimated deployment extrinsic fee | 1.1933 tPOT | 0.6369 tPOT |
| Provisional budget, including 25% deposit margin, 1 tPOT additional deposit allowance and 40 tPOT working buffer | 1,199.4283 tPOT | 643.0975 tPOT |
| Shortfall against 500 | 699.4283 tPOT | 143.0975 tPOT |

The runtime reports 0.06 tPOT per stored byte and a 30% code-hash lockup factor. Constructor storage and other items also contribute to the quoted deposit. Limits and margins are reserves, not a claim that the full limit will be charged. The 40 tPOT working buffer remains provisional and does not prove that every seed/e2e account and transaction is funded. Raw deployment alone would leave only about 18.19 tPOT before setup and later activity.

Compiler experiments rejected disabling via-IR (larger candidate code) and retained ordinary Solidity and the existing transfer helper. Storing fixed deployment terms in storage rather than repeating immutables reduced candidate creation size from 6,482 to 6,143 bytes; there are no external setters.

## Reproduce without spending tokens

```sh
npm run contracts:build
npm run deploy:check:candidate
npm test
npm run typecheck
```

The comparison reads the public account from `deployments/preflight.json`, uses a funded public origin for runtime cost discovery, and estimates the deployment fee with `paymentInfo`. It does not load a mnemonic, derive a signer, sign, submit, export the candidate into the SDK, or overwrite the existing deployment preflight. Results are in `deployments/core-candidate.json`. A failed or reverted constructor stops the comparison instead of becoming a zero-cost estimate.

Validation: all 99 local tests passed (64 contracts, 12 SDK, 16 web, 7 server); four opt-in live SDK tests were skipped by the local command. Candidate coverage includes 18 tests, with 512 randomized solvency inputs plus the stored regression case, late joining, failed-transfer rollback, permissions, default boundaries, protected closure, delayed withdrawals and a malicious payment-token callback. Typecheck passed. This is not a security audit or proof of a live payment lifecycle.

## Required before adoption

1. Measure the complete native setup and a small lifecycle, including listing storage and participant balances, using read-only estimates or a local node. Keep the 500 tPOT allocation intact while checking.
2. Resolve the remaining operating budget through further measured reductions or confirmed organiser support. Do not describe 500 as sufficient yet.
3. Add a versioned SDK adapter, document validation/resolution, event/indexer mapping and API compatibility; preserve verified live behaviour and honest unavailable states.
4. Re-run lifecycle/accounting regression checks, review the new contract, then deploy only when its measured budget fits. Record actual contract addresses and transaction hashes after successful execution.
