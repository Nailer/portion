# Judge feedback and response — 11 November 2026

## The feedback

A judge reviewing Portion in the Portaldot developer forum wrote that it implements the full flow of share purchase, revenue distribution and on-chain records, with testnet transactions as evidence, and that the materials are relatively complete. The two weaknesses:

1. **No verification that the assets and the revenue are real.**
2. **Funds flow directly to the operator.**

Together these make Portion "closer to an on-chain bookkeeping tool than a trustworthy revenue-sharing protocol".

Both points are fair. The deployed Core v1 records what the operator says and pays purchase money straight to it.

## What changed, and where

All of this is in Core v2 (`contracts/src/candidates/PortionCoreV2.sol`). It is not deployed: it runs in the [browser sandbox](https://portion-one.vercel.app/sandbox) and in tests. The deployed Core v1 cannot be changed.

| Weakness | Already in Core v2 | Added on 11 November |
| --- | --- | --- |
| Money goes straight to the operator | Purchase money is **held by the contract** and released in tranches. Each tranche needs evidence, the reviewer's approval and a one-period challenge window. Missed targets, two failed tranches, a slash, a cancel or a wind-down **refund the unreleased money** to buyers | Later tranches also wait for the revenue check below, so more money reaches the operator only once the asset has been shown to earn |
| No check that the asset is real | A **named, independent reviewer** must attest, with an evidence hash, before any sale opens | **T2:** the reviewer must re-confirm the asset with `confirmAsset`, for example after a site visit. No tranche is released on a confirmation more than **90 days** old |
| No check that the revenue is real | Only the operator's own deposits count as revenue; third-party deposits cannot inflate the record | **T1:** after the first tranche, no tranche is released until the reviewer has **verified the operator's revenue** with `verifyRevenue`, recording that deposits up to that total match evidence such as meter readings or bank statements. All of it must be verified, with a check made since the last release. If the reviewer will not verify, requests lapse, and two failures refund buyers |

**Evidence.** Seven new Foundry tests, two new invariants and three injected bugs, all caught (see [verification evidence](VERIFICATION-EVIDENCE.md)). The sandbox has a fourth guided tour, "See the reviewer check revenue and the asset", in which the release is refused until the reviewer verifies, then goes through.

## What this does not solve

T1 and T2 make every later release wait for a **named person's recorded check**. They cannot make that person honest or the evidence true. An operator and reviewer acting together can still release escrow. The first tranche is released before any revenue exists, because it may pay to build the asset.

## Tasks still to do, in order

| # | Task | Why | Needs |
| --- | --- | --- | --- |
| 1 | Deploy Core v2 on the Portaldot testnet | Escrow and the new checks are only in the sandbox today | About 840–1,170 tPOT of storage deposit from the organisers |
| 2 | Reviewer accountability: a reviewer bond that is slashed if an attestation is shown to be false, and a 2-of-3 reviewer quorum | One reviewer is a single point of trust | Design, tests and a dispute process |
| 3 | Revenue that needs no trusted person: signed readings from the asset's meter, or attestations from the payment provider that collects the revenue | Checks evidence at the source instead of trusting a reviewer | A metering or payment partner, and an oracle design on Portaldot |
| 4 | Expected-revenue reconciliation: state the revenue share in the terms and compare deposits with metered output | Catches an operator depositing less than it earned | Terms change and data source from task 3 |
| 5 | Fix C10 (rounding) and C11 (last-minute staking) in Core v2 | Known accounting issues | Contract change and tests |
| 6 | External audit of Core v2 | Required before any real money | Funding |
| 7 | Pilot with a real operator, with named reviewers and a legal view | Proves demand and the review process | Operator agreement |

## Draft reply for the forum

> Thank you for the careful review. You are right on both points for the deployed contract: Core v1 records what the operator reports and pays purchase money straight to it.
>
> Our Core v2 addresses both, and today we added the missing piece, ongoing verification:
>
> - **Funds no longer go straight to the operator.** Purchase money is held by the contract and released in tranches. Each needs evidence, approval from a named independent reviewer and a one-week window in which holders can challenge. A missed target, two failed tranches, a default or a cancel refunds the unreleased money to buyers.
> - **Revenue must be verified before more money flows.** After the first tranche, which may pay to build the asset, no tranche is released until the reviewer has checked the operator's reported revenue against evidence such as meter readings or bank statements, and recorded that check on chain. If the reviewer will not verify, requests lapse and buyers get the unreleased money back.
> - **The asset must be re-confirmed.** The reviewer must confirm the asset still exists and works at least every 90 days, for example after a site visit, or releases stop.
>
> It is covered by 7 new tests, 2 new invariants and 3 deliberately injected bugs, all caught. You can try it without a wallet in the sandbox (tour 4): https://portion-one.vercel.app/sandbox. Code: [PR LINK]
>
> What this does not solve yet: it relies on a named reviewer being honest. Our next steps are a slashable reviewer bond with a 2-of-3 quorum, then revenue evidence that needs no trusted person, such as signed meter readings or payment-provider attestations. Core v2 also still needs testnet deployment, which requires more test tokens, and an external audit.
>
> We would value your view on which matters more for a first pilot: reviewer accountability, or source-signed revenue data.
