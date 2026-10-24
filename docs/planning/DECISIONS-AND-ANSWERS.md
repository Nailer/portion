# Portion — decisions and plain-language answers

Baseline: 24 October 2026. These answers explain the product and the decisions behind the [56-task backlog](MASTER-BACKLOG.md). **Confirmed** means supported by source or recorded tests, not independently audited. **Recommended** is a product decision. **Unvalidated** requires customer, wallet, organiser or professional evidence. No real-money launch or outside communication is authorized here.

## Product and customer

### 1. What exactly are we building, and why is it meaningful?

**Recommended direction:** infrastructure that helps equipment operators present funding terms, record participation and manage payments to funders. An operator should spend less effort answering “who funded this, what did we promise, who is due a payment, and what was actually paid?” Funders should inspect those records. The value is the useful administration and accountability, not blockchain transactions themselves. Whether this solves an expensive enough customer problem remains unvalidated. Tasks: B01, B03, O01, O03.

### 2. Who should use and pay for Portion first?

**Recommended:** the equipment operator is the first proposed paying customer; funders are the other user group. Start discovery with the solar company the founder can reach, then the other reachable group. Access to a contact is not a partnership. Global infrastructure remains the ambition; an initial operator is a narrow learning opportunity, not a Nigeria-only strategy. Tasks: B01, B02, B04.

### 3. Should we keep the idea or pivot?

**Recommended:** keep the direction while testing it. Continue if operators have a specific recurring problem, credible cash flows and willingness to pay enough to cover delivery. If they value records and payouts but not raising funds through Portion, evaluate that narrower offering. If neither service matters enough to pay for, reconsider the model. Do not continue merely because code exists or abandon it merely because wallet setup is difficult. Task: B08.

### 4. Why use Portaldot instead of a conventional database?

**Confirmed technical distinction:** Portion combines native NFT deeds, native fractional shares and approvals with Solidity accounting, plus separately stored hashed documents. A conventional database can still run the business administration more simply. Portaldot is useful if shared, inspectable token and payment records and controlled share supply matter to the customer. It cannot prove equipment exists or that the operator reported all revenue. Validate the benefit against the extra account, storage and support costs. Tasks: S04, B01, B05.

### 5. What is the actual customer workflow?

An operator connects an existing supported wallet, checks funding readiness, enters asset information and terms, reviews costs, approves document storage and creates the offer. A funder inspects terms, evidence, bond and risks, then approves a purchase. The operator later deposits payments; participating staked shares receive allocations that holders can claim. Each stage needs a clear success/failure record. Public browsing needs no wallet or tokens. Tasks: W04–W08, T01–T07, O03–O08.

## What works and what remains unproven

### 6. Is Portion functional already?

**Confirmed:** Core is deployed, public verified services respond, and the real create → purchase → deposit → claim → unstake lifecycle finalized. **Not yet proved:** the entire flow through a real extension with independent operator and participant accounts, an actual equipment business, paying customers or production operations. The completed test used a development script and one account. Task creation does not erase these limits. Tasks: W01, T07, B02, R09.

### 7. Why can’t I buy from the Portion test listing now?

**Confirmed:** its 100 test shares were bought during the completed test, so the primary offer is sold out. They were unstaked back to the development wallet. That is a completed test, not a broken purchase button or a market with actual investors. It remains useful for inspecting documents, proof and payment records. We should explain this in the UI and not spend another creation deposit merely to make it look active. Tasks: T06, O07, F01.

### 8. Are we allowed to keep this test listing despite the no-mockup requirement?

Yes: the founder explicitly authorized a clearly labelled protocol test. Its transactions, amounts and receipts are real testnet records; the terms explicitly say it represents no physical equipment, commercial investment or real earnings. It must remain labelled and must not become evidence of customer demand. Other business listings need genuine supplied information and permission. Tasks: O01, O07, D04.

### 9. What will convince a judge that this works?

A clear customer problem, understandable UI, actual deployed code/receipt identity, a coherent end-to-end demonstration and reproducible checks. Judges should be able to follow the evidence without taking our claims on trust. Show that document uploads are separate from the atomic deed/share/listing batch. State which actions are historical and which are being performed live. A polished animation or passing test count alone is insufficient. Tasks: S04–S07, T04, D04.

## Wallets, identity and getting started

### 10. Which wallet is it: Portaldot or Polkadot?

Portaldot is the network/product context. Some compatible wallets use the Polkadot/Substrate injected account-and-signer interface. The use of that interface does not mean the visitor must install a different network's wallet. Keep Portaldot Wallet first, verify the actual provider and installation destination, and list other wallets only after testing them. Tasks: W01, W03.

### 11. Can ordinary MetaMask sign the main asset flow?

**Confirmed current limitation:** an ordinary EVM address/signature alone cannot sign the native NFT, fractionalization, asset and document calls used by the website. Do not imply ordinary MetaMask supports the full flow. Any later bridge or EVM-only action is a separate capability. Never derive a second spending key from a message signature as a sign-in workaround. Task: W03.

### 12. Does a transaction hash work as a private key? Do visitors need our wallet?

No. A hash is a public receipt and grants no signing access. Visitors should control their own wallets; Portion never needs their recovery words. The development wallet was used only for an explicitly authorized development test. Using it does not give the founder's separate wallet control of that listing. Keep deployment keys out of the hosted API and browser. Tasks: W01, W02, R09.

### 13. Why does a user need faucet tokens before creating an asset?

Filling out an unsigned form and viewing public records cost nothing. Publishing requires native tPOT for execution and storage deposits. Test pUSD serves the bond/purchase/payment role and cannot replace native transaction funding in the current flow. The readiness screen must explain the two balances before signing, rather than waiting for an opaque failure. Tasks: W05–W08.

### 14. Should we create wallets or give visitors an automatic starting balance?

No. The public app should neither create a hidden spending identity nor present invented opening funds. It can guide the user to a compatible wallet and explicit official token allocation/test-pUSD request. Development signer helpers are separate from visitor sign-in. Tasks: W03–W05, W07.

### 15. What should happen if the user rejects signing, switches accounts or uses the wrong network?

Stop or invalidate the reviewed action, explain the reason and preserve already completed public receipts. Do not silently select another account or keep a review bound to the previous identity. The user reviews a newly prepared action when identity/network changes. These paths need real-wallet checks as well as regressions. Tasks: W02, T01, T05.

### 16. What about legacy browser records containing old locally held keys?

The current app must not read or restore them as sign-in. Do not silently delete a person's only legacy backup either. Document a deliberate recovery/migration path if needed, with the user controlling any secret material; never add a recovery-phrase web form or log old records. Task: W03; reference ACCOUNT-CONNECTION.md.

## Costs and transaction recovery

### 17. How much faucet is left, and should we spend it again?

**Last verified snapshot:** 44.82920824 tPOT in the deployment wallet after the authorized test, with a separately funded test-credit service account. This is not a new balance check. The completed test changed the operational floor to 40 tPOT; the earlier 70 tPOT policy was superseded for that test. Preserve the current floor unless explicitly changed, refresh balances before any write, and do not assume a new listing fits the small headroom. Tasks: F01, F02.

### 18. Why did creating one test listing cost so much? Was it all gas?

No. The free-balance reduction includes storage deposits and execution fees, not only gas. Native NFT attributes and contract state both carry storage costs. Deposits may be recoverable only when the corresponding state is legitimately freed; they are not automatically available spending money. The full authorized test and correction reduced free balance by 47.56004989 tPOT. Do not call all of that a burned network fee. Tasks: W06, F01, F02.

### 19. What did we optimize, and what is the next sensible optimization?

**Confirmed:** storing the exact document hash as 32 raw bytes instead of 74 text bytes saves 2.52 tPOT at the observed per-byte rate. Batching the test lifecycle also released temporary stake state. Next, improve current-state cost estimates, reuse existing assets and run read-only checks first. A cap is an upper allowance, not the amount necessarily charged. Do not remove safeguards or redeploy Core just to claim lower gas. Tasks: W06, F01, F02.

### 20. Do we need more faucet tokens or another deployment?

The existing Core does not need redeployment to demonstrate what it already does. Additional independent testers may need native allocations for mapping, approvals, storage and participation. Requesting more is conditional on a measured test plan; it is not mandatory merely because a deadline is approaching. A support request must use the official process and accurate remaining costs, not obsolete estimates. The backlog itself sends no request or tokens. Tasks: F01, F02, W07, T07.

### 21. How should we handle a failed step or missing public listing?

Distinguish upload acceptance, successful chain creation and public receipt publication. If a transaction finalized but publication failed, retry publication, not asset creation. If tracking timed out, the outcome is unknown until reconciled. Keep known hashes/identities and recover safely after a refresh. Retrying all steps blindly can spend funds twice. Tasks: T01–T04.

### 22. How do we know displayed numbers are real?

Read balances, listing totals and pending claims from the identified chain/contract; verify document hashes and finalized receipts. Distinguish unknown, unavailable, zero and illustrative estimates. When an estimate is useful, label its assumptions. Retain source/time and exact units for exported money records; do not invent historical strike/deposit counters Core does not expose. Tasks: W05, R01, R03, O04, O05, O08.

## Operator accountability and funder protection

### 23. What does the deed/share proof actually establish?

It checks a native deed, fractionalization mapping, original/current supply and pallet-controlled asset roles, plus the runtime transfer lock. It does not verify the existence, condition, value or legal ownership of equipment. Our historical signed read-only transfer returned nfts.ItemLocked even before an optional explicit item flag was set; ordinary users must not be forced through a collection-Freezer-only operation. Tasks: O01, R06; evidence: portion-deed-lock-check.json.

### 24. Where does funder income come from?

From money the operator actually deposits, allocated under the contract to earning shares. Tokenization itself creates no equipment revenue. The current test deposit was test credits supplied by the development account, not solar income. A real business needs credible collections and operating costs that can support its obligations. Tasks: B03, B07, O04.

### 25. What happens when an operator does not pay?

Core tracks time since listing initialization or a qualifying operator payment. It becomes late and then defaulted under the chosen cadence; slashing can distribute the held bond according to the contract. A limited bond is not insurance for the full investment. The deployed Core already rejects new buy/stake participation in default; broader recovery/eligibility and external caller boundaries still need review. Tasks: O06, R06.

### 26. Can a funder get their original money back by unstaking?

No. Unstaking returns shares and changes earning participation; it does not reverse the purchase or guarantee principal repayment. Selling requires an actual permitted buyer or available market liquidity. A listed asset alone does not create a functioning secondary market. Explain this before purchase and show unavailable pools honestly. Tasks: O06, O08, T06, B06.

### 27. What evidence should an operator supply?

A permitted identity/contact profile, asset description and documents, the source of business income, funding terms, payment schedule and relevant rights/obligations. State who supplied or checked each item, and when. A hash proves the bytes match; it is not independent verification. Collect no more private information than necessary and never publish it merely because an upload field exists. Tasks: O01, B02, B03, B06.

## Business model and long-term viability

### 28. How can Portion make money?

**Confirmed mechanism:** the deployed Core uses a fixed 1% share-sale fee and 0.5% deposit fee in test pUSD. Those test-token receipts are not commercial revenue. **Unvalidated options:** a company management subscription and/or onboarding fee if operators value the administration enough to pay. These are pricing hypotheses, not working paid features. The old configurable-fee description applies to a different contract and should not be presented as current Core behaviour. Tasks: S01, B04, B05.

### 29. Will the transaction fees alone make a viable company?

We do not know; for small, high-support offerings they may not cover onboarding and service costs. Measure contribution after hosting, support, verification, legal/payment providers, collection costs and acquisition. Do not count user deposits, operator bonds, grants, token appreciation or hackathon prizes as recurring business income. Tasks: B04, B05.

### 30. Do operators need to earn money from using Portion too?

They need a benefit worth more than the total cost: useful funding or less work, clearer records, fewer disputes and more reliable payment administration. But a platform cannot manufacture an equipment business's profit. Check whether net funding covers actual equipment costs and whether operating cash flow supports payments, the bond and fees. If not, change the offering or business model rather than increasing promised returns. Tasks: B03–B05, B08.

### 31. How do we validate this without claiming fake traction?

Ask the solar operator about their last actual financing/payment problem, inspect permitted records, show the relevant workflow and ask for a specific pilot commitment and price response. Record rejections and conditions as well as enthusiasm. Do not claim an interview, pilot, partnership, customer or revenue before it happened. Founder-led discovery can begin while engineering fixes onboarding. Tasks: B01, B02, B04.

### 32. What must be resolved before accepting real investment?

A qualified review of the first offering's enforceable rights and obligations, eligible participants, custody, collection/payment path, identity, disclosures, disputes, transfers and default/exit. Production security and operating readiness must also be reviewed. The testnet hackathon is not evidence that these questions are resolved. This is a review requirement, not jurisdiction-specific legal advice or a claim of compliance. Tasks: B06, B07, R06, R09.

### 33. How can it be global while starting with one operator?

Build reusable account, asset, agreement, reporting and payout concepts; learn from a narrow first pilot. Add currencies, eligibility and payment routes only where supported. Global direction does not mean everyone in every country may buy every offering. Do not hardcode the product around Nigeria, but do not promise universal financial access either. Tasks: B02, B06, B07.

## Reliability, privacy and design

### 34. Can users trust the complete history and document availability today?

Only within the stated scope. The hosted feed retains verified receipts published through the app; outside transactions may be absent. Core totals remain authoritative. Native document retention is finite and hosted verified copies provide continued access, but restore/backup and outage handling need evidence. No automatic renewal or complete archive guarantee should be implied. Tasks: R01, R02, R09, R10.

### 35. What security and operating work is still necessary?

Review the dependency advisory reported through Blob/OIDC/CLI configuration, faucet concurrency and nonce handling, service quotas, backups, restore, secret rotation, unknown outcomes and direct-call/backing boundaries. Retain finalized-only receipts, hash checks and signer binding already implemented. This is targeted hardening, not a claim that existing test coverage equals an independent security audit. Tasks: R03–R07, R09.

### 36. Should we redesign everything again or add more animations?

**Recommended:** refine the current brand and flow. Improve image quality, spacing, hierarchy, responsive layouts, primary actions and transaction feedback. Use motion to explain progress and state changes, with reduced-motion support. A new colour scheme or decorative animation cannot compensate for a confused next step. The existing low-resolution on-chain test image cannot be silently replaced under its hash; improve future uploads and label any alternate rendering honestly. Tasks: D01–D03, O02, R08.

### 37. How will we know the website is understandable and professional?

Observe first-time users trying actual tasks without coaching: explaining Portion, finding an asset, understanding fees and risks, locating a receipt and identifying the next action. Record where they hesitate, then fix those points. Test desktop/mobile, keyboard/focus and slow/disconnected services. Measure before/after performance rather than announcing an unsupported perfect score. Tasks: D02, D03, R08, R10.

### 38. What do we market, and when?

Market the actual problem and working testnet evidence as the journey becomes understandable. State the test is one development account and the offer is sold out; do not imply independent investors, verified equipment, guaranteed returns or mainnet readiness. Customer discovery can start now. Broad acquisition should wait until visitors have a coherent usable next action. External posting/contact requires the founder's explicit direction; creating these tasks sends no messages. Tasks: D04, B01, T06, T07.

## Hackathon execution and leadership

### 39. Which awards should we target?

**Recommended:** lead with Ecosystem DApps. Use the SDK/native composition as a supporting contribution and investigate Middleware eligibility only where actual demonstrated scope supports it. Do not build an undeployed bridge merely to list four tracks. Public rules allow Community Choice to stack, but ambiguous multiple-track award eligibility should be confirmed with the organiser; a prize is not promised. Tasks: S03, F03.

### 40. What are the immediate submission obligations?

The official page was read on 24 October: check-in is 24 October at 13:00 Lagos; office-hour application is 27 October at 13:00; final submission/code freeze is 6 November at 05:00. The founder must confirm actual registration/check-in status. Supply current progress, outstanding work, public repository, architecture, contract/receipt and live demo for check-in, then the required final video/deck and runnable evidence. If a deadline is missed, ask the organiser; do not assume an extension. Tasks: S01, S02, S04–S07.

### 41. Who does what, and what is next?

Engineering owns implementation, costed tests, reproducibility, service reliability and technical evidence. The founder owns team/registration facts, customer access, consent, commercial decisions and submission confirmation. Real-wallet testers supply the user-driven approval evidence. Start with current documentation/check-in and budget/security checks, then wallet readiness, cost visibility and safe recovery. Run operator interviews alongside that work. Finish the usable core and final materials before adding peripheral scope. See the first work sequence in MASTER-BACKLOG.md.

### 42. Does creating these tasks mean the fixes or customer answers are finished?

No. There are 56 actual GitHub issues, each with its own acceptance evidence. Some expand or verify foundations already delivered. This document answers what can be established now and gives a decision process for what remains unknown. Customer willingness to pay, formal pilot commitment, actual separate-wallet use, eligibility and production readiness require real evidence; inventing positive answers would make the project weaker, not more professional.

## Evidence and sources

- [Official Portaldot event details](https://dorahacks.io/hackathon/2362/detail), read 24 October 2026. Recheck organiser updates before action.
- [Live Core release](../LIVE-CORE-RELEASE.md) and [actual test receipts/results](../LIVE-TEST-RESULTS.md).
- [Account connection](../ACCOUNT-CONNECTION.md), [business assumptions](../BUSINESS.md), [technical review](../TECHNICAL-REVIEW.md). These contain historical statements; S01 tracks reconciliation of current entry points.
- Current source: Core.sol, SDK Core adapter, hosted public-api.ts, wallet/runner state and native-proof code. No new chain transactions, customer contacts or pricing commitments were made for this planning work.
