# Investment assessment — Portion, 27 October 2026

Written from the viewpoint of a demanding ecosystem committee. This is an evaluation perspective, not the view of Portaldot, an organiser or an investor, and it uses no inside information. No interview, partnership, willingness to pay, revenue or testimonial exists, and none is claimed. Evidence labels: **Fact** (checked in source, chain or an official page), **Reasoned** (a conclusion from facts), **Assumption**, **Needs customer evidence**.

## Verdict

**Support conditionally, in small milestone-gated steps. Do not support the current direction as an open funding marketplace.**

The software is real and unusually honest about its limits. The *funding* half of the story is the weakest part: purchase money goes straight to the operator, nothing verifies the asset or the revenue, and every incumbent that works controls collections, verification or a legal wrapper that Portion lacks. The *revenue-allocation* half is real, narrow, and cheap to demonstrate. The defensible product is a verifiable ledger and payout administration for an operator who already has funders. Whether anyone will pay for it is unknown.

## The question, answered

**Why should an operator use Portion?** Reasoned, needs customer evidence: to give funders a record they do not have to take on faith — each deposit is public, the split is computed by code, and anyone can reproduce the numbers — in place of a spreadsheet and bank statements. It is a modest benefit and only matters if funders ask for it.

**Why should a participant trust its safeguards?** They should trust only what is enforced, and the product now says which that is: shares and a bond are held by the contract; deposits are split by stake with the fee shown; only the holder can claim. They should **not** trust that equipment exists, that revenue is complete, or that purchase money is spent as described. Those depend on people Portion does not control.

**Why should the ecosystem invest?** Weakly today, plausibly later. Today: a working native-assets-from-Solidity example and an open SDK. Later, only if an operator uses it: recurring deposit and claim transactions are the on-chain activity that follows. No such activity exists yet beyond one development account.

## Facts, reasoning, assumptions

| Claim | Type | Support |
| --- | --- | --- |
| Core v1 is deployed and its create/buy/deposit/claim/unstake run finalized | Fact | `deployments/*.json`, `docs/LIVE-TEST-RESULTS.md`, `/evidence` |
| One account was both operator and buyer; script signer; no browser-wallet proof | Fact | Same records |
| Purchase proceeds go directly to the operator, less 1% | Fact | `PortionCore.sol` `buy` |
| `create` is permissionless; nothing verifies the asset | Fact | `PortionCore.sol` `create` |
| Bond ≥ 5% of the offered value; default is two missed periods; slashing needs someone to submit it | Fact | `PortionCore.sol` |
| 1% / 0.5% fees cannot fund a company | Reasoned | `docs/FINANCIAL-MODEL.md` (assumed costs) |
| Incumbents control collections, verification or a legal wrapper | Reasoned | `docs/MARKET-AND-COMPETITORS.md` (largely secondary sources) |
| A subscription to the operator is the only model whose revenue scales with work | Reasoned | Same |
| An operator will pay for this | **Needs customer evidence** | None |
| Funders want an on-chain record enough to ask for it | **Needs customer evidence** | None |
| A solar operator reachable by the founder has the right problem | Assumption | One potential interview, not a partnership |

## The seven questions

1. **Who has the problem?** Small operators of productive equipment who share income with a handful of funders, and those funders. Assumption.
2. **What recurring job is painful?** Reporting deposits and allocating them fairly, on a schedule, in a way funders can check. Needs customer evidence that it is painful *enough*.
3. **How is it handled today?** Spreadsheets, bank transfers, email statements, sometimes a bookkeeper. Reasoned; not researched with any operator.
4. **Why switch?** Only if funders insist on verifiable records, or the operator wants to attract funders by offering one. A blockchain is not, by itself, a reason.
5. **Who pays, for what, how often?** Proposed: the operator, a recurring fee for the administration scope, with per-transaction fees as a usage component. **Not validated.**
6. **Why is it worth more than it costs?** Not yet. At current fees it is worth less than the cost to serve for all but very large raises (`FINANCIAL-MODEL.md` §A).
7. **Why Portaldot?** Native assets and NFTs are usable from Solidity without writing a token contract, terms live in the chain's own storage, and deposits and claims are cheap to execute and publicly auditable. This is a genuine technical fit; it is not a market reason.

## Direction chosen

**Narrow the first product to operator revenue-sharing administration**: record the terms, deposit revenue, allocate to holders, let each claim, export receipts. Funding stays as an optional, test-only module. This is a positioning and workflow decision, fully reversible, and does **not** change any deployed economics, participant rights or immutable terms. The interface now leads with the payout story and states where the money is controlled and where it is not.

Why: the payout path is the part the software actually enforces and can already demonstrate; the funding path would need escrow, reviewers and legal structure that do not exist; and the only comparable *software* precedent (sponsor-side administration) sells to the operator for a subscription.

What stays: everything implemented. What changes: framing, evidence presentation and the reviewer journey. What does not change: Core v1.

## What could make the business fail

- No operator pays. The likeliest failure; unaddressed by any code.
- Funders do not value an on-chain record over a statement from someone they already trust.
- The operator under-reports revenue and the ledger faithfully records a lie.
- Regulation: pooled funding of income-producing assets is likely a regulated activity in many places. Not assessed; needs qualified review.
- Service cost (verification, support, disputes) exceeds what a small operator can pay.
- A default that costs participants real money before real controls exist.

## Which gaps need what

| Gap | Fix needed |
| --- | --- |
| Misuse of purchase money | Contract change (escrow/milestones; candidate built, undeployed) + named reviewers + outside review |
| False asset or revenue claims | Operating process (independent verification, collections) + outside review |
| Conflicts of interest | Contract rule (implemented in candidate) + disclosed reviewers |
| Eligibility, custody, rights | Qualified legal review |
| No buyers for shares | No software fix; do not imply liquidity |
| Reporting and recovery | Product (largely done) |

Full trace: [MONEY-AND-TRUST-LIFECYCLE.md](MONEY-AND-TRUST-LIFECYCLE.md).

## Evidence that would change this recommendation

**Upgrade (support more firmly):** a written pilot commitment from a real operator at a stated price; a witnessed browser-wallet session by a separate user; a named independent reviewer for a first asset; a legal opinion that a defined first offering is permissible; an operator who deposits real (test) cycles on schedule.

**Downgrade (do not support):** the operator interview shows no pain or no willingness to pay; funders do not care about the record; legal review blocks pooled funding in the first jurisdiction; the operator cannot or will not share revenue evidence.

## Milestone-gated support, in order

1. Witnessed separate-user browser signing, with receipts (needs a funded tester account).
2. Operator discovery completed; findings recorded without embellishment.
3. A one-page pilot scope with a price and what is included.
4. A named reviewer process and a legal view *before* any controlled-release deployment.
5. Only then, a budgeted migration plan for the controlled-funding design.

## Pitch spine (for the founder's deck; not a built deck)

1. The recurring job: sharing income from equipment, verifiably. 2. What works today: contract, recorded lifecycle, evidence page. 3. Why Portaldot: native assets from Solidity, on-chain terms. 4. What is *not* protected, plainly. 5. Business: operator subscription hypothesis and the cost model. 6. Ask and milestones above.
