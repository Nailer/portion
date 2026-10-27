# Controlled-funding candidate — local only, not deployed

`contracts/src/candidates/ControlledFunding.sol`, tested by `contracts/test/ControlledFunding.t.sol` (23 Foundry tests, including a 512-run conservation fuzz). It turns [CONTROLLED-FUNDING-DESIGN.md](CONTROLLED-FUNDING-DESIGN.md) into code so the rules can be attacked in tests. **It is not deployed, not in the SDK, not in the app, and nothing in this review migrated funds or changed any authority.** It is an engineering candidate, not an audit, a legal structure or a promise of protection.

## What it does

| Design requirement | Candidate behaviour |
| --- | --- |
| Separate balances | Contributions sit in the escrow per campaign; `held(id)` = raised − released − refunded; a test checks the sum over campaigns equals the token balance |
| Funding target, deadline, cap | Anyone can `finalize` after the deadline (or at the cap). Below target → refunds; at or above → active |
| Fixed beneficiaries and shares | Set at creation as basis points summing to 10,000; there is no function to change them. The last milestone takes the remainder so no unit is stranded |
| Evidence and release | Operator `propose`s with an evidence hash; the **independent reviewer** and the **participant representative** each `approve`; a challenge window then runs; anyone may call `release` |
| Operator cannot approve itself | Operator ≠ reviewer ≠ representative, enforced at creation; the operator cannot be a beneficiary or a contributor; the reviewer cannot contribute |
| Challenge | A contributor holding ≥10% of the raise can stop the open proposal (dust cannot stall a release) |
| Unavailable approvers | A proposal expires; `lapse` clears it; a second failure opens refunds, so funds are never trapped |
| No double payment | A milestone is paid once, sequentially; the proposal is cleared on release |
| Atomic payment | State changes first, transfer last; a failed transfer reverts and leaves the milestone unpaid (tested with a token that returns false) |
| Refunds | Only the *unreleased* balance returns, pro rata; released money is not recoverable (tested); at most one unit of dust per contributor stays |
| Reentrancy | A guard on every state-changing function; the test asserts the nested call is rejected with `Reentrancy` specifically |

## Known limits — do not oversell this

- **A reviewer and a representative who collude can still release money to a bad vendor.** The contract cannot judge evidence. It only ensures that three separate parties and a delay stand between the operator and the money.
- **A 10% contributor can force a refund** with two challenges. That is a deliberate safety-first parameter, and also a griefing vector; a vote would be better and is not built.
- **Who the reviewer and representative are, how they are chosen, paid and replaced, is entirely outside the contract.** Their availability and honesty are the real control.
- **It does not issue shares or allocate revenue.** An adapter would read `contributed` and mint or distribute shares to Core. That integration, and any migration of existing Core listings, is not designed here.
- No fee, no deadline extension (a new campaign is needed), no partial-milestone amounts, no token other than the one fixed at deployment, and no handling of vendor-delivery disputes beyond challenge and refund.
- Mutation check: five deliberate bugs (guard removed, operator allowed to fund, challenge window skipped, approvals skipped, refund pool ignoring releases) were each caught by the suite. That shows the tests are sensitive; it is not a substitute for independent review.

## Before it could ever be used

Named reviewers and a representative process; a legal view on custody and eligibility; independent contract review; a budgeted deployment and migration plan; an adapter to Core; real operator evidence that milestones are what operators need. None is authorised or done. Deployment would also need a fresh cost estimate against the 40 tPOT reserve.
