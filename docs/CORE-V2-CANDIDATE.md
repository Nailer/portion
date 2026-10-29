# Core v2 candidate — local only, 29 October 2026

`contracts/src/candidates/PortionCoreV2.sol` is Core v1 with five loopholes from the [market-readiness review](MARKET-READINESS-REVIEW.md) closed or narrowed: C1, C2, C3, C4 and C7. **It is not deployed, not audited and not used by the SDK or the web app.** The live listing 585886 stays on Core v1. No chain write, spend or deployment occurred.

Tests: `contracts/test/CoreV2Loopholes.t.sol`. Run from `contracts/`:

```bash
forge test --match-path test/CoreV2Loopholes.t.sol
```

- `CoreV1LoopholeTest` (6 tests) runs each attack against the **deployed v1 code**. These tests pass because v1 can be exploited.
- `PortionCoreV2Test` (20 tests) runs the same scenarios against v2 and shows each attack refused. It also checks that v1 behaviour worth keeping survives: fees, payouts, late joiners and default protection. A fuzz test with 512 runs checks that the contract always holds enough to pay every claim, the reserve and the bond.

## What changed

| Finding | v1 behaviour (demonstrated) | v2 change |
| --- | --- | --- |
| **C1** Token deposit keeps the listing on time | A 1-unit minimum and 1-unit weekly deposits kept a 1,000 pUSD raise "on time" for 52 weeks | At creation, the stated minimum must annualise to at least 2% of the offered value (`MIN_ANNUAL_BPS`). Smaller deposits do not reset the clock |
| **C2** Faked revenue history | The operator staked its 90 retained shares; a 100 pUSD "deposit" recorded 99.5 of revenue and cost it 10.45 | The operator address cannot buy or stake its own listing, so every operator deposit reaches outside holders. Deposits from other addresses are counted separately (`otherDeposits`), not as the operator's record |
| **C3** Nothing staked | Deposits were refused, the operator was pushed into default, and 49.5 of the 50 pUSD bond went to the **treasury**. Or the operator wound down at once and withdrew its bond, leaving holders with 100 shares and nothing behind them | A deposit with nothing staked still counts and is held in a **reserve** for holders. The reserve is released with the next deposit or slash that finds stakers. A slashed bond never reaches the treasury. Wind-down needs a public notice two periods ahead, during which holders can stake to block it; it is also blocked while any reserve is held |
| **C4** Holders who unstaked lose the bond | A holder who had unstaked could not restake in default and received none of the bond | Staking stays open during default; new buying does not. A slash opens one period after default (three missed periods in total), so holders have time to restake. The operator can still cure the default by depositing before then |
| **C7** The operator key can never change | A deposit from a replacement key never qualified, and the listing defaulted | An optional **recovery** address, set at creation, may propose a new operator; so may the operator. The new operator accepts after one period. The operator cannot replace a proposal made by the recovery address, and a new operator may not hold stake in the listing |

Interface changes: `Terms` gains `recovery`; `Listing` gains `recovery`, `pendingOperator`, `pendingAfter`, `pendingByRecovery`, `windDownAfter`, `otherDeposits` and `reserve`. New functions: `noticeWindDown`, `proposeOperator`, `acceptOperator`. Fees (1% sale, 0.5% deposit), the 5% minimum bond, the 1% slash tip and the treasury address are unchanged. The SDK and the web app would both need updates before v2 could be used.

## Limits that remain

- **C2 is narrowed, not closed.** An operator can still stake through a second address it controls. The contract cannot tell who owns an address; only identity checks outside the contract can (review item M3).
- **C1 depends on a placeholder.** 2% a year is a policy value nobody has validated. An operator can still state the minimum floor and deposit exactly that while earning more. Only independent revenue checks can close this (review item M4).
- **The reserve rewards whoever is staked at release.** Someone who stakes just before the next deposit shares the reserve; v1 already behaves this way for ordinary deposits. If nobody ever stakes again, the reserve stays in the contract and the operator cannot wind down.
- **Recovery has a window.** A thief with the operator key can act during the one-period delay: close the sale and take the unsold shares, or propose an address and have it accepted if the recovery address does nothing. A listing created without a recovery address is no better off than on v1.
- **Compensation is slower.** Holders wait one more period before a slash can pay them.
- **Unchanged from v1:** no escrow or minimum raise (C5; see the separate [controlled-funding candidate](CONTROLLED-FUNDING-CANDIDATE.md)), a small bond (C6), no pause or upgrade path (C8), and anyone can list (C9).

## Evidence of test strength

Each fix was undone in turn by an injected bug, to check that at least one v2 test fails. **All nine injected bugs were caught.** The script was a scratch file and is not in the repository.

| Injected bug | Caught by |
| --- | --- |
| C1 minimum floor removed | `test_C1_minimumMustAnnualiseToTwoPercentOfOffer` |
| C2 operator allowed to stake | `test_C2_operatorCannotStakeOrBuyOwnListing` |
| C3 slashed bond paid to treasury | `test_C3_slashWithNothingStakedNeverPaysTreasury`, `test_C4_unstakedHolderCanRestakeBeforeSlash` |
| C3 wind-down without notice | `test_C3_windDownNeedsNoticeAndHoldersCanBlockIt` |
| C3 reserve ignored at wind-down | `test_C3_reserveBlocksWindDown` |
| C4 slash allowed as soon as default begins | `test_C4_operatorCanCureBeforeSlash`, `test_C4_unstakedHolderCanRestakeBeforeSlash` |
| C4 staking blocked in default again | `test_C3_slashWithNothingStakedNeverPaysTreasury`, `test_C4_unstakedHolderCanRestakeBeforeSlash` |
| C7 operator may override recovery | `test_C7_recoveryReplacesOperatorAfterNotice` |
| C7 no acceptance delay | `test_C7_recoveryReplacesOperatorAfterNotice` |

The full Solidity suite passes: 117 tests (91 existing and 26 new). Runtime size is 6,794 bytes against 4,832 for v1, both well under the 24,576-byte EVM limit.

**Testing note.** Under `via_ir`, `block.timestamp` read inside a test function can be cached, so a second `vm.warp(block.timestamp + …)` does not move time forward. The new tests advance time from `vm.getBlockTimestamp()`. Among the older tests, only two (both in `ControlledFunding.t.sol`) advanced time more than once in a function. That file now uses the same pattern, and all 23 of its tests still pass. The other older tests advance time at most once per function, so they are not affected.

## Before any use

The two-wallet testnet session; a second engineer's review; combining this with the controlled-funding candidate; an external audit before any real money; a migration plan, because v1 listings cannot move to v2 automatically; and the testnet tokens to deploy it, which nobody has authorised.
