# Core v1 protection boundaries — engineering review, 25 October 2026

Scope: the deployed Core source, native adapter/proof checker, wallet runner and
existing local contract regressions. This is an engineering review, not an
independent audit, legal opinion or certification. No bytecode was changed or
redeployed. Independent review and real operator evidence remain release gates.

| Concern | Actual enforcement | Limit and disposition |
| --- | --- | --- |
| Purchase money misuse | `buy` transfers net proceeds directly to the operator. | **No spending-controlled escrow.** Interface disclosure is now prominent. Use the proposed controlled-release model before claiming protected fundraising. |
| Operator bond | Core escrows the declared bond, enforces a minimum and restricts withdrawal/closure. | The minimum is far below a full offering. No principal insurance or physical repossession follows. |
| Missed payments | Core computes late/default, rejects new buy/stake in default, and allows a slash transaction. | No autonomous keeper or forced collection exists. A top-up does not reset the deadline. |
| Slash allocation | Caller tip is deducted; current stakers share the remainder, or it goes to treasury if no stake remains. | Past purchasers who have exited stake are not automatically the recipients. UI now states this explicitly. |
| Claims after exit | `_harvest`, debt and owed accounting retain earned claims after unstaking; new stake starts at current accrued debt. | Tiny integer rounding dust can remain; no bank payout or automatic claim is implemented. |
| Native deed backing | Native pallet mapping/Locker, supply and role checks are verified by the proof endpoint and web purchase preflight. | **Core `create` itself does not enforce NFT fractionalization, fixed native roles or physical rights. Direct callers can bypass web checks.** Do not market all permissionless listings as verified equipment. A future contract/runtime adapter must bind these identities on-chain or admit only independently verified offerings. |
| Native share identity | Core derives a precompile from a native asset ID and checks supply at creation. | Supply alone is insufficient provenance. A mutable native asset, a misleading document or the payment asset itself must not be treated as valid equipment shares merely because `create` accepted it. Web proof rejection is a narrower boundary than a contract invariant. |
| Payment token | Versioned deployment fixes the token and treasury; the app verifies configured identity and runtime code. | The test token has an issuer and no monetary value. A native issuer can mint test credits; deposits are not audited business profit. |
| Callbacks/transfer failures | Guarded entry points and checked transfer helpers; atomic failures roll back state. | Current regressions are relevant evidence, not a complete adversarial audit of the runtime/precompiles or arbitrary tokens. |
| Account/network changes | External signer checks before/after approval, selected-account invalidation, genesis checks and review identity binding. | A transaction already broadcast cannot be undone by disconnecting. Browser approval and separate-user finalization still need real-wallet evidence. |
| Duplicate actions | Public submission identities are saved before normal native signing; upload checkpoints retain IDs and receipts; unknown results block automatic reuse. | Local records are device-specific. Manual data deletion, another client and direct chain calls are outside that local guard. No automated financial retry is introduced. |
| Revenue/history | Core cumulative allocation is compared to paginated app receipts at a finalized snapshot. | Matching totals do not establish complete history or actual company revenue. Missing events stay partial/unavailable. |
| Physical asset/legal rights | Hashed documents preserve published bytes. | A hash, NFT or attractive photo proves neither equipment existence nor enforceable ownership. B06/B07 must identify the actual responsible parties and eligible users. |

The existing finalized test demonstrates one development account creating,
buying, depositing, claiming and unstaking. It does not establish independent
operator/customer use, revenue collection, compliant custody or investor demand.

Before a monetary release: independent contract/runtime review, verified operator
evidence, custody/rights/eligibility review, collection responsibilities, realistic
operating cost and a separately approved migration plan are required. There is
no budget authorization to replace the existing contract in this review.

See [controlled-funding design](CONTROLLED-FUNDING-DESIGN.md) and
[current money flow](FUNDING-PROTECTION.md).
