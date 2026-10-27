# Money and trust lifecycle — Core v1 as deployed, checked against source on 27 October 2026

Source of truth: `contracts/src/PortionCore.sol` and the live Core at `0x17501f45…`. This file describes **what is** and classifies **what has to change**; it is an engineering review, not an audit or legal opinion. Controlled-release is specified in [CONTROLLED-FUNDING-DESIGN.md](CONTROLLED-FUNDING-DESIGN.md) and implemented only as a **local, undeployed** candidate (see [CONTROLLED-FUNDING-CANDIDATE.md](CONTROLLED-FUNDING-CANDIDATE.md)).

## Step by step

| # | Step | Who acts | Who controls the money | What the software enforces | What relies on outside people or records | What can fail | What the user can do next |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Operator admission** | Operator, from any wallet | None | Nothing. Anyone can call `create`; there is no admission list. | Any identity or licence check. None exists. | A bad or fraudulent operator lists freely. Direct contract callers skip every web check. | Participants must judge the operator themselves. Treat unreviewed listings as unverified. |
| 2 | **Asset evidence** | Operator uploads photo and terms | None | The terms document's hash is stored; bytes can be checked against it. The web app checks that the deed NFT, fractionalization and supply match. | That the equipment exists, is owned, insured and in the operator's control. | A convincing photo of an asset that does not exist, or belongs to someone else. A hash proves *unchanged*, not *true*. | Ask for independent evidence outside Portion; do not rely on a badge. |
| 3 | **Terms** | Operator | None | Terms are hashed and stored; share count, price, deposit cadence and bond are fixed at creation. | Whether the terms are legally enforceable against the operator. | Terms cannot be amended; mistakes need a new listing. | Read the terms and the on-chain checks before buying. |
| 4 | **Funding** | Participant approves in their wallet | Participant until `buy`; then the operator | Share transfer, 1% sale fee to treasury, net to operator, in one transaction. Rejected in default or after the sale closes. | Nothing — there is no target, deadline, refund or minimum raise. | A raise that gets 3% of its goal still pays the operator at once. | Buy only an amount you can lose. |
| 5 | **Use of proceeds** | Operator | **Operator alone** | **Nothing.** | Everything: the operator spending on the described equipment. | Misuse, theft, waste or a vendor that never delivers. Nothing can pause or reverse it. | None inside Portion. This is the largest gap. |
| 6 | **Business collections** | Operator's customers pay the operator, outside Portion | Operator | Nothing | Honest and complete reporting | Revenue is under-reported, diverted or deposited late. | Watch for missed periods; compare the deposit record with what the operator says. |
| 7 | **Deposited revenue** | Operator calls `deposit` | Contract, until claimed | The 0.5% fee is taken; the rest is split by shares staked at that moment. A qualifying deposit resets the late clock. | That the deposit equals what was earned. | A small token deposit keeps the clock green while real revenue is hidden. | Read the cumulative deposit history, not just the status. |
| 8 | **Allocation** | Contract | Contract | Exact-unit split; late joiners do not receive earlier deposits; unstaked holders keep their earned claim. | — | Integer rounding leaves dust. Exited holders are not paid slashes. | Stake shares to earn; unstaking stops *future* income only. |
| 9 | **Claim** | Holder | Contract → holder | Only the holder's own allocation can be claimed; pull payment. | The holder remembering to claim. | No automatic payout; unclaimed funds just wait. | Claim from the Portfolio page. |
| 10 | **Exit** | Holder | Holder | Unstake returns shares; claims are retained. | A buyer for the shares. There is no market unless someone funds a pool. | Shares cannot be sold; unstaking never returns the purchase price. | Hold, or find a counterparty yourself. |
| 11 | **Default** | Anyone submits `slash` | Contract | After two missed periods, new buying stops; the bond (≥5% of offered value) is shared with current stakers after a 1% caller tip. | Someone noticing and paying to submit the slash. No keeper runs. | The bond is far smaller than the raise. Past buyers who already exited receive none of it. | Submit a slash when it applies; treat the bond as limited recovery. |

## Failure scenarios the review was asked to check

| Concern | Where it bites | Classification of the fix |
| --- | --- | --- |
| **Misuse of proceeds** | Step 5 | **Contract change** (escrow, milestone release) **plus operating process** (named reviewers) and **outside review**. Specified; candidate built locally; not deployed. |
| **False asset claims** | Step 2 | **Operating process** (independent verifier) and **outside review**. A contract can only record that a named reviewer attested, not that the asset exists. |
| **Missing or hidden revenue** | Steps 6–7 | **Operating process** (collection accounts, reconciliation) and **product** (surface cumulative-vs-claimed and coverage honestly — done). The contract cannot see off-chain sales. |
| **Conflicts of interest** | Operator also acts as buyer, as in the recorded test | **Contract change** (approver ≠ operator; implemented in the candidate) and **process** (disclosed reviewers). |
| **Unavailable approvers** | Controlled release | **Contract change** (expiry, fallback to refund; implemented in the candidate) and **process** (named alternates). |
| **Failed funding target** | Step 4 | **Contract change** (target, deadline, refund; implemented in the candidate). Not in Core v1. |
| **Default** | Step 11 | Bond is small. **Product** (clear disclosure — done); **contract/process** (larger bond or staged release); **legal** for asset remedies. |
| **Refunds** | Step 4 | Core v1 cannot refund. Candidate refunds only *unreleased* money. Already-spent money is not recoverable. |
| **Transfers** | Share transfers | Shares are ordinary native assets; the contract cannot restrict who holds them. **Legal review** needed before any real-money use. |
| **Lack of buyers** | Step 10 | **Product honesty** (no secondary market implied — done). Liquidity needs real counterparties; cannot be built by software alone. |

## What this means for the product

- A disclosure does not close a protection gap. The web app now states plainly where each gap sits.
- Core v1 is a **revenue-allocation ledger**. It is not a protected funding product, and the interface no longer presents it as one.
- Do not accept real money until step 5 and step 2 each have an enforced control and a named responsible party, and until qualified legal review covers eligibility, custody and rights.
