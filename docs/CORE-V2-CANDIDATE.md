# Core v2 candidate — not deployed, 29 October 2026

`contracts/src/candidates/PortionCoreV2.sol` is Core v1 with all nine contract loopholes from the [market-readiness review](MARKET-READINESS-REVIEW.md) closed or narrowed, C1 to C9. The SDK, the server and the web app all support it, but only when a deployment file names `core-v2`. **It is not deployed and not audited.** The live site and listing 585886 stay on Core v1. No chain write, spend or deployment occurred.

## How a v2 listing works

1. **Create (Pending).** The operator publishes terms and locks the offered shares and a bond, as in v1. It must also name an **independent reviewer**, an optional **recovery** address, a **funding target** in shares, a **deadline**, and a **release schedule** of 1 to 12 tranches.
2. **Review (Funding).** No one can buy until the named reviewer calls `attest` with the hash of the evidence it checked. Its address and that hash are recorded permanently.
3. **Funding.** Buyers' payments are **held by the contract**, not paid to the operator. Purchased shares are staked and locked until the raise settles.
4. **Settle.** Once the offer sells out or the deadline passes, anyone may call `finalize`:
   - If the target was met, the listing becomes **Active** and the deposit clock starts.
   - If not, it opens **full refunds**: each buyer gets back everything they paid, their shares return to the operator, and the operator can withdraw its bond.
5. **Release.** For each tranche the operator proposes an evidence hash, and the reviewer approves it. Holders with at least 10% of sold shares staked can challenge it for one period, after which anyone may release it. The operator receives the tranche less the 1% sale fee, so the fee is now taken on release, not at purchase. A defaulted operator receives no tranche.
6. **Failure.** Any of these returns the **unreleased** money to buyers, pro rata to what they paid:
   - two failed tranche requests (challenged or expired)
   - a slash
   - an operator cancel
   - a wind-down

   Money already released cannot be recovered.
7. **Revenue.** Deposits, claims, staking, default and slash work as in v1, with the C1–C4 changes below.
8. **Pause.** A guardian address fixed at deployment (intended to be a multisig) can stop new money for at most seven days, and must wait seven more before pausing again. During a pause, creating, attesting, buying, proposing and releasing stop. Claims, unstaking, refunds, deposits, challenges and slashes never stop.

## What changed, finding by finding

| Finding | v1 behaviour | v2 change |
| --- | --- | --- |
| **C1** Token deposit keeps a listing on time | Demonstrated: 1-unit weekly deposits kept a 1,000 pUSD raise "on time" for a year | The stated minimum must add up to at least 2% of the offered value per year (`MIN_ANNUAL_BPS`) |
| **C2** Faked revenue history | Demonstrated: a 100 pUSD "deposit" recorded 99.5 of revenue and cost the operator 10.45 | The operator cannot buy or stake its own listing; the reviewer cannot buy; deposits from other addresses are counted separately (`otherDeposits`) |
| **C3** Nothing staked | Demonstrated: either a forced default sent 49.5 of the 50 pUSD bond to the treasury, or the operator wound down at once and withdrew its bond | Deposits and slashed bonds are held in a **reserve** for holders, never sent to the treasury. Wind-down needs two periods' notice, and is blocked while anything is staked or reserved |
| **C4** Holders who unstaked lose the bond | Demonstrated | Staking stays open in default. A slash opens one period after default |
| **C5** No escrow, no minimum raise | Every purchase paid the operator at once | Escrow, funding target, deadline, full refunds on a missed target, tranche release with reviewer approval and holder challenge |
| **C6** Small bond, default only stops new buying | Holders recovered at most the 5% bond | A slash also opens refunds of all unreleased escrow, so the money still held becomes the main protection. The minimum bond is still 5% of the offer |
| **C7** The operator key can never change | Demonstrated | Optional recovery address; rotation takes one period; the operator cannot override a recovery proposal |
| **C8** No emergency stop | No pause, no upgrade path | Time-limited guardian pause that never blocks claims or refunds; written migration plan below |
| **C9** Anyone can list | Direct contract calls skipped every check | No sale opens until the independent reviewer attests on-chain. The reviewer cannot be the operator or the recovery address |

Fees are unchanged: 1% on sales, now taken from each released tranche, and 0.5% on deposits. The minimum bond, the 1% slash tip and the treasury address are unchanged too.

## Tests

From `contracts/`:

```bash
forge test --match-path test/CoreV2Loopholes.t.sol
```

- **`CoreV1LoopholeTest` (6 tests)** runs C1, C2, C3 (two routes), C4 and C7 against the deployed v1 code. These tests pass because v1 can be exploited.
- **`PortionCoreV2Test` (33 tests)** covers:
  - every finding from C1 to C9;
  - the escrow paths: a failed raise, release timing, a defaulted operator, two challenged tranches, small-holder challenge, cancel, and slash with escrow still held;
  - the pause paths;
  - regressions of v1 behaviour.

  A 512-run fuzz test checks that the contract always holds at least every claim, the reserve, the bond and the escrow, with at most a few units of rounding dust left over.
- **SDK (`packages/sdk/test/core.test.ts`)** covers reading escrow state, when a sale counts as open, refund amounts, the guardian check, refusing v2 actions on v1, and validation of funding controls that mirrors the contract.
- **Web (`apps/web/test/escrow-panel.test.tsx`)** checks that the panel's timing matches the contract, that only the right roles see each action, and that it never claims a guarantee.

Totals: 130 Solidity tests (91 existing and 39 new), 56 SDK (14 new), 67 web (8 new) and 40 server, all passing.

## Evidence of test strength

Each fix was undone in turn by an injected bug, to check that at least one v2 test then fails. The script was a scratch file and is not in the repository.

**21 of 22 were caught on the first run. The miss was real:** with the reviewer-approval check removed from `release`, no test failed. The existing test only tried to release before the challenge window had passed, which the timing rule refuses anyway, so it passed for the wrong reason. In use, that bug would let any tranche be released one period after it was requested, without the reviewer. I added `test_C5_unapprovedTrancheNeverReleases`, which waits past the window so that only the missing approval can stop the release. Rerun against the same bug, it fails as it should. **All 22 are now caught.**

| Injected bug | Caught by |
| --- | --- |
| C1 minimum floor removed | `test_C1_minimumMustAnnualiseToTwoPercentOfOffer` |
| C2 operator allowed to stake | `test_C2_operatorAndReviewerCannotBuyOrStake` |
| C3 slashed bond paid to treasury | `test_C3_slashWithNothingStakedNeverPaysTreasury`, `test_C4_…`, `test_C6_…` |
| C3 wind-down without notice | `test_C3_windDownNeedsNoticeAndHoldersCanBlockIt` |
| C3 reserve ignored at wind-down | `test_C3_reserveBlocksWindDown` |
| C4 slash allowed as soon as default begins | `test_C4_operatorCanCureBeforeSlash`, `test_C4_unstakedHolderCanRestakeBeforeSlash` |
| C4 staking blocked in default again | `test_C4_unstakedHolderCanRestakeBeforeSlash` |
| C5 purchase paid straight to the operator | eight tests, including the fuzz test |
| C5 funding target ignored | `test_C5_failedRaiseRefundsInFullAndReturnsShares` |
| C5 release without reviewer approval | `test_C5_unapprovedTrancheNeverReleases` (added after the miss) |
| C5 release to a defaulted operator | `test_C5_defaultedOperatorGetsNoTranche` |
| C5 any holder may challenge | `test_C5_smallHolderCannotChallenge` |
| C5 shares unlocked during funding | `test_C5_purchaseMoneyIsHeldNotPaidToOperator` |
| C5 refunded buyer keeps the shares | `test_C5_failedRaiseRefundsInFullAndReturnsShares` |
| C6 slash leaves escrow with the operator | `test_C6_slashAlsoReturnsUnreleasedEscrow` |
| C7 operator may override recovery | `test_C7_recoveryReplacesOperatorAfterNotice` |
| C7 no acceptance delay | `test_C7_recoveryReplacesOperatorAfterNotice` |
| C8 pause has no effect | `test_C8_pauseStopsNewMoneyButNeverClaimsOrRefunds`, `test_C8_pausedCreationAndBuying` |
| C8 no gap between pauses | the same two tests |
| C8 a pause-overlapped request counts as a failure | `test_C8_lapseDuringPauseDoesNotCount` |
| C9 sale before attestation | `test_C9_noSaleBeforeNamedReviewerAttests` |
| C9 operator as its own reviewer | `test_C9_reviewerMustBeIndependent` |

## Size and deployment cost

Runtime code is **13,308 bytes**, against 4,832 for v1. That is 54% of the 24,576-byte EVM limit.

Portaldot charges a storage deposit of **0.06 tPOT per byte of code**. Deploying is checked by:

```bash
npm run deploy:check:core-v2 -- --guardian 0x…
```

The command is read-only by default, and it never touches `deployments/portaldot-testnet.json`. On 29 October 2026 the runtime refused even a dry run, because the deployer could not cover the deposit (`StorageDepositNotEnoughFunds`). So the figure below is an estimate, not a measurement:

| | tPOT |
| --- | --- |
| Code-only deposit, 13,308 bytes × 0.06 | 798 |
| Upper estimate (v1's measured deposit was 1.385× its code-only figure) | 1,106 |
| Operating floor that is never spent | 40 |
| Deployer free balance at block 238,201 | 44.83 |
| **Needed from the organisers** | **about 800 to 1,110**, with a margin on top |

Once funded, the same command measures the exact deposit, and `--execute` deploys. Execution refuses unless the measured deposit, the fee and the 40 tPOT floor are all covered. It then verifies the deployed code byte for byte, along with the payment token and guardian, and writes `deployments/portaldot-testnet-v2.json`.

v2 stores its token, treasury and guardian addresses in storage rather than baking them into the code, as v1 does. That is what lets the app compare deployed code with the reviewed artifact.

**Reducing the cost** is possible but not done: the size is driven mostly by the 37-field `listing` view and the escrow logic. Splitting the view into smaller ones could save a few hundred tPOT. That work is worth doing only if the organisers' allocation is tight.

## Switching the app to v2 (after deployment)

1. Run the deployment above, then review `deployments/portaldot-testnet-v2.json`.
2. Copy it to `deployments/portaldot-testnet.json`. The web app and API both read that file. v2 receipts and documents go under a new storage namespace (`portion/core-v2/…`), so v1 history stays where it is.
3. Set `guardian` in the deployment file. The app refuses a contract whose guardian differs from it.
4. Republish the API and the web app with the documented `vercel deploy --prod` release step.
5. **Listing 585886 stays on v1.** Nothing moves automatically, because v1 has no migration function. Its record remains readable by pointing a separate deployment file at v1. Any new listing goes on v2.

### Migration plan for a future version

v2, like v1, has no upgrade path, by design. A future version is a new contract.

- **Old listings stay** on their contract. Holders keep claiming and unstaking there.
- **The pause cannot trap funds.** It stops new money only, so a guardian can pause v2 while v3 is prepared without blocking anyone's claims or refunds.
- **Operators close cleanly.** An operator moving to a new version gives wind-down notice on the old one; nothing staked or reserved can be stranded, because the contract refuses to close until both are zero.

## Limits that remain

- **C2 is narrowed, not closed.** An operator can stake, or a reviewer can buy, through another address they control. Only identity checks outside the contract can stop that (review item M3).
- **The reviewer is trusted.** The contract records who attested and approved; it cannot know whether they checked anything. An operator and reviewer acting together can release escrow, and the only remaining check is a challenge from holders with at least 10% of sold shares. Choosing and naming reviewers is an operating process (review item M4).
- **The 2% floor is a placeholder.** An operator can deposit exactly the minimum while earning more.
- **Refunds follow the original payer.** If shares were transferred after purchase, a refund still goes to whoever paid.
- **The reserve goes to whoever is staked at the next deposit or slash.**
- **Guardian power.** A guardian can delay releases and purchases for up to seven days out of every fourteen. A tranche request that a pause overlapped does not count as a failure.
- **Recovery has a one-period window.** A thief with the operator key can act during the delay, and a listing without a recovery address gets no help.
- **Compensation is slower.** Holders wait one more period before a slash.
- **No audit.** An external audit is required before any real money.
