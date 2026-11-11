# Verification evidence — 2 November 2026

The check-in mentors wrote "Technical base to be strengthened". This records what was done in response and what it found, so a reviewer can rerun it. **None of this is an audit.** No outside party has reviewed the code, and Core v2 is not deployed.

## The live contract matches the source

`npm run verify:chain` reads public endpoints only. It needs no wallet or keys and spends nothing. Result at block 297,480: **15 of 15 checks passed** ([record](../deployments/chain-verification.json)).

- The deployed code is byte-identical to `contracts/src/PortionCore.sol` compiled here: 4,832 bytes, hash `0xf4209552…171535`.
- The deployment transaction created this contract, and the create and lifecycle transactions succeeded.
- Replaying the 6 contract events recomputes sales, stakes, revenue, the per-share accumulator, each holder's position and the 0.5% fee, and all equal what the contract reports. The contract's token balance of 5 test pUSD equals the bond plus unclaimed income.

If a recorded transaction is left out, the recomputed totals stop matching and the script fails. That was tested, as was pointing it at a different contract.

**Limits.** It proves the code and accounting match. It does not prove that equipment exists, that revenue is complete, or that the contract is safe. Transactions are named rather than discovered, because Portion's native batches are not indexed by `eth_getLogs` and scanning every block is too slow for the public node's rate limit.

## Invariant tests

These run random call sequences and check properties that must hold after any of them. They are in `contracts/test/PortionCore.invariant.t.sol` and `PortionCoreV2.invariant.t.sol`, and CI runs them on every push at a smaller size.

Result on 2 November: **3,000 random sequences of 64 calls for each of the 15 properties, all passing**. On 11 November, after T1 and T2 were added, the 9 Core v2 properties passed **1,000 sequences of 64 calls each** (seed 2026). To rerun, from `contracts/`:

```bash
FOUNDRY_INVARIANT_RUNS=3000 FOUNDRY_INVARIANT_DEPTH=64 forge test --match-contract InvariantTest --fuzz-seed 2026
```

| Property | v1 | v2 |
| --- | --- | --- |
| Tokens held plus tokens claimed equal everything owed: bonds, unreleased escrow and allocated income | ✓ | ✓ |
| Holders are owed what was allocated, within the rounding described below | ✓ | ✓ |
| Shares held equal shares for sale plus shares staked | ✓ | ✓ |
| Total staked equals the sum of all stakes | ✓ | ✓ |
| The treasury receives exactly the published fees | ✓ | ✓ |
| Offered shares are only sold, still for sale, or returned | ✓ | |
| Closed listings hold no shares or stakes | ✓ | |
| Defaulted listings never take new money | ✓ | |
| Purchase money leaves only as a tranche or a refund, and refunds never exceed the pool | | ✓ |
| An operator or reviewer never holds stake in the listing | | ✓ |
| After the first tranche, escrow reaches the operator only on fully verified revenue and a reviewer check of the asset under 90 days old (T1, T2; added 11 November) | | ✓ |
| The reviewer never verifies more revenue than the operator deposited (T1; added 11 November) | | ✓ |

### Do the tests catch bugs?

Ten bugs were injected one at a time into a separate copy of the contracts, and all ten were caught. On 11 November three more were added for the new T1 and T2 checks, and all three were caught; the first run missed the asset check, so guided releases now sometimes jump months ahead before trying. Earlier runs missed three v2 bugs, which showed that random calls rarely reached a tranche release and never tried staking as the operator. The tests were improved and the whole set rerun.

| Injected bug | Caught |
| --- | --- |
| v1: deposit fee doubled | ✓ |
| v1: a claim can be repeated | ✓ |
| v1: a slash leaves the bond on record | ✓ |
| v1: unstaking leaves total staked unchanged | ✓ |
| v1: buying allowed during default | ✓ |
| v2: a released tranche is not recorded | ✓ |
| v2: a refund is not recorded | ✓ |
| v2: the refund pool ignores money already released | ✓ |
| v2: a slash pays the bond to the treasury | ✓ |
| v2: the operator may stake | ✓ |
| v2: the revenue check before a later tranche removed (T1, 11 November) | ✓ |
| v2: the 90-day asset check removed (T2, 11 November) | ✓ |
| v2: the reviewer may verify more than was deposited (T1, 11 November) | ✓ |

This is a small hand-picked set, not a full mutation test. It shows these tests can fail, not that they catch everything.

## Finding C10: rounding can over-allocate

The invariant tests found this. It was not known before.

**What happens.** When a stake changes, the contract rounds the holder's reward debt down. A holder can then be credited under one smallest unit too much for each stake change. In this sequence holders are owed 8 units when only 7 were deposited:

```
holders hold 2 and 1 shares → deposit 2 → first holder stakes 1 → deposit 3 → first holder unstakes 1 → deposit 2
```

**Effect.** The extra unit comes from whatever else the contract holds: the bond or another listing's money. If nothing else is held, the last payout fails until someone sends that unit to the contract. `PortionCoreRoundingTest` demonstrates each of these.

**Severity: low.** One unit of test pUSD is 0.000001. A transaction costs far more than the unit gained, so it is not a profitable attack. The recorded test listing is unaffected: its claims equal its revenue exactly.

**Status.** Core v1 is deployed and cannot change. Core v2 has the same rounding and is not fixed. The fix is to keep the reward debt unrounded and divide only when paying out. Applying it changes the v2 bytecode, so the sandbox would need rebuilding and redeploying. Fix it before v2 goes on any network.

## Outside report: KupiaSec, 2 November 2026

KupiaSec, a security firm, read the public repository and emailed two issues, offering a paid audit. They said they had not tested against the live deployment. Both issues were reproduced here as tests. No audit was commissioned, and this is not one.

**1. A defaulting operator can recover most of its own bond (slash route of C2).** In Core v1 the operator can stake the shares it kept back, and `slash()` pays whoever is staked. With 100 shares, 20 sold at 10 pUSD and a 10 pUSD bond, the operator stakes its 80 and defaults: of the 9.9 pUSD paid out, the operator gets 7.92 and buyers 1.98, about 1% of the sale rather than the 5% bonded. `test_C2_operatorRecoversMostOfItsOwnBond` shows it in v1. Core v2 refuses stake from the operator, so the whole 9.9 goes to buyers (`test_C2_operatorCannotRecoverItsOwnBond`). The live test listing has nothing staked, so nothing is at risk there.

**2. A last-minute staker takes a share of the next deposit (new finding C11).** Deposits are split among whoever is staked at that moment. A holder who keeps shares unstaked can stake just before a predictable operator deposit, claim and unstake at once: with two 50-share holders, the one who staked for an instant takes half of the deposit from the one who stayed staked all week. Both versions behave this way (`test_C11_lastMinuteStakerTakesShareOfDeposit` and `test_C11_lastMinuteStakerStillTakesShareOfDeposit`). **Severity: medium-low.** It needs shares already and a known deposit time. **Not fixed.** The fix is to make new stake wait a period before it earns, or to credit deposits by time staked, before v2 goes on any network.

Their third point, that moving purchase money into the contract raises the stakes of the same accounting, is general and is already why Core v2 is described as unaudited.

## Test coverage

Measured with `forge coverage --ir-minimum` ([full table](evidence/coverage-summary.txt)). This mode changes how the code is compiled, so the numbers are close to the deployed build rather than identical. Coverage shows which lines ran, not that they are correct.

| Contract | Lines | Branches | Functions |
| --- | --- | --- | --- |
| `PortionCore.sol` (deployed) | 96.93% (158/163) | 93.75% (30/32) | 100% (23/23) |
| `PortionCoreV2.sol` (candidate) | 98.74% (314/318) | 83.95% (68/81) | 97.56% (40/41) |
| `ControlledFunding.sol` (candidate) | 99.23% (129/130) | 67.57% (25/37) | 100% (17/17) |

The rest are legacy contracts, and `SandboxToken`, which the browser sandbox exercises rather than Foundry. All 149 contract tests passed when coverage was measured; 153 pass after the outside-report tests were added.

## Static analysis

Slither 0.11.3, excluding informational results ([all 55 results](evidence/slither-results.json)). **No high-severity results in any contract.** The table covers the deployed contract and the v2 candidate.

| Result | Where | Assessment |
| --- | --- | --- |
| Medium: `total` local never initialized | `PortionCoreV2.create` | False positive. It is a counter that starts at zero, as Solidity defines |
| Low: uses timestamp for comparisons | `PortionCore` (2), `PortionCoreV2` (13) | Intended. Payment periods are measured in days, so small timestamp shifts do not matter |
| Low: no zero-check on `guardian_` | `PortionCoreV2` constructor | Intended. A zero guardian turns pausing off |
| Optimization: variables could be immutable | Both | Intended. Stored values keep the deployed code byte-identical to the artifact, which is what the app and the script above verify |

The remaining results are in legacy and superseded contracts that are not deployed in this release. They were not triaged.

Slither did not find C10. The invariant tests did.
