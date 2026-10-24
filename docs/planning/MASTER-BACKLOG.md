# Portion — complete delivery backlog

Planning baseline: **24 October 2026**. This is the task-creation baseline, not a claim that the work below is complete. GitHub issues are the authoritative live status; this document and JSON are snapshots.

**56 individual tasks: 1 completed, 55 open** cover the product, wallet, transaction reliability, operator tools, security/operations, business, design and hackathon gaps. Each has a priority, proposed lead role, dependencies and completion evidence. Lead roles do not assign people or imply someone has accepted the work.

Follow [Task progress](TASK-PROGRESS.md) for completed work and the active next step. Read [Decisions and answers](DECISIONS-AND-ANSWERS.md) for the plain-language reasoning. Evidence baseline: [live Core release](../LIVE-CORE-RELEASE.md), [finalized live test](../LIVE-TEST-RESULTS.md), [engineering review](../TECHNICAL-REVIEW.md), [business direction](../BUSINESS.md), and current source. Historical review items were reconciled rather than blindly reopened as deployment blockers.

## Priority and scope

- **P0:** eligibility, trust, safe execution or critical first-use foundations. Start in the dependency order below; P0 does not mean all 21 items can be completed today.
- **P1:** professional product delivery, demonstrated browser use and final-submission quality.
- **P2:** evidence-gated expansion or work needed before a later real-money pilot. Not required merely to make the hackathon checklist longer.
- Task creation authorizes tracking, not new chain spending, contacting customers, posting marketing, binding agreements or a real-money launch. External communications need the founder's explicit instruction; live writes need an action-specific budget.
- Last verified deployment-wallet free balance: **44.82920824 tPOT**, measured after the 23 October authorized test. This is not a fresh balance query. Preserve the latest approved **40 tPOT** operational floor unless a later explicit decision changes it. The old 70 tPOT deployment reserve was superseded for that completed test, not a second pool of money.
- No further contract deployment is currently required. Prefer read-only checks, isolated test fixtures and existing receipts. A fresh creation test cannot be assumed affordable from the remaining headroom.

## What is already delivered

| Completed foundation | Evidence and practical limit |
| --- | --- |
| Public repository and Vercel app | GitHub Nailer/portion; portion-one.vercel.app. A Git push alone does not establish a Vercel deployment. |
| Core deployed and runtime checked | Contract `0x17501f4510ba4298b618209e105cd47036509706`, deployment block 160455. No redeployment needed merely to demonstrate it. |
| Versioned Core SDK and real payment asset | Native asset 4217, ABI/document adapter and chain-backed catalog resolver. Browser readiness remains separate. |
| Actual create/buy/deposit/claim/unstake test | Listing 585886 and finalized receipts. One development account played both roles; this does not prove independent customer use. |
| Public verified document/receipt services | Vercel API and Blob; app-submitted receipts are partial history, not a full chain archive. |
| Separate test-pUSD issuer | Actual grant recorded; native faucet disabled and deployer key absent from hosted API. Concurrency review remains open. |
| Wallet-owned signing design | No web recovery-phrase import, generated visitor wallet or opening balance. Real extension approval is not yet fully evidenced. |
| Finality, hash and identity protections | Regression coverage and source implement material safeguards; interruption/end-to-end checks remain open. |
| Lower deed storage and corrected runtime lock proof | Exact 32-byte document hash saves 2.52 tPOT at the observed rate. Native fractionalization already blocks deed transfer; Freezer-only lock is not required for ordinary users. |
| Rebrand and aligned Tools navigation | Custom geometric mark and desktop/mobile checks. Sharp media, accessibility, loading performance and usability still need follow-up. |
| Existing default/bond/claim accounting safeguards | Tested Core source already blocks new buy/stake participation after default; independent adversarial and legal/operational reviews remain outstanding. |

## First work sequence

| Order | Work | Lead | Exit gate |
| --- | --- | --- | --- |
| 1 | S01 → S02, plus S03/S04 | Engineering + founder | Accurate check-in evidence; actual founder submission/registration state recorded. |
| 2 | F01 and R05/R07 | Engineering | Known budget, dependency triage and reproducible checks; no token spending by CI. |
| 3 | W01/W02 → W04/W05 → W06 | Engineering + a real-wallet tester | Wallet identity, first-use guidance and costs are understandable and verified. |
| 4 | T01/T02/T03/T05/T06 | Engineering | Rejection, partial progress, unknown outcomes and sold-out records recover safely. |
| 5 | T07 when funded and cost-approved | Engineering + two testers | Separate-user browser evidence; never relabel the existing script run as this proof. |
| Parallel | B01 → B03/B04 → B05/B08 | Founder + reachable operator | A documented customer problem, pricing response and continue/adjust decision. |
| 6 | O01–O08, R01–R10, D01–D03 as dependencies permit | Engineering + product | An operator/funder can complete and understand the selected usable core. |
| 7 | S05/S06/D04 → S07 | Founder + engineering | Honest public demo/deck, release evidence and final freeze readiness. |

The first sprint is steps 1–4, not all 56 tasks. The business work runs alongside it. Final feature cut is driven by these exit gates, not a promise to implement every P2 feature before judging.

## Hackathon timing and ownership

The official DoraHacks details were read on 24 October 2026: check-in **24 October 13:00 Lagos**, office-hour application **27 October 13:00**, final submission/code freeze **6 November 05:00**, live demo **8–9 November UTC**. Confirm organiser updates and the actual demo slot. If check-in is missed, the founder contacts the organiser; no extension is presumed. Source: https://dorahacks.io/hackathon/2362/detail

The founder supplies team facts, confirms registration, submits materials and authorizes customer contact. Engineering supplies code, deployment/receipt evidence and reproducibility. The final submission language should be the team's own, grounded in the evidence; these documents are planning and explanation, not a claim that submission has happened.

## Individual tasks

### 0 — Submission truth

#### POR-S01 — Reconcile current project status and remove contradictory live claims

- **GitHub:** [P0 · issue #1](https://github.com/Nailer/portion/issues/1)
- **Status:** completed 24 October 2026; see [acceptance evidence](TASK-PROGRESS.md). **Lead role:** Engineering.
- **Dependencies:** None.
- **Work:** Reconcile current-entry docs against the release and live receipts; retain historical reports with dated labels; distinguish scripts from browser signing.
- **Done when:** Current guides consistently describe deployed Core, partial receipt coverage, disabled native faucet, unsupported services and test-only results.

#### POR-S02 — Confirm registration and complete the check-in requirements

- **GitHub:** [P0 · issue #2](https://github.com/Nailer/portion/issues/2)
- **Status:** in progress; founder confirms registered, not submitted. Evidence packet ready; submission confirmation outstanding. **Lead role:** Founder.
- **Dependencies:** [POR-S01](https://github.com/Nailer/portion/issues/1).
- **Work:** Confirm team registration and actual submission state; assemble progress, remaining work, repo, architecture, deployment receipt and demo link; ask the organiser about recovery if the deadline was missed.
- **Done when:** Founder retains actual submission confirmation or organiser response. No registration or submission is claimed without evidence.

#### POR-S03 — Select awards based on demonstrated scope

- **GitHub:** [P0 · issue #3](https://github.com/Nailer/portion/issues/3)
- **Status:** open at creation. **Lead role:** Founder + engineering.
- **Dependencies:** [POR-S01](https://github.com/Nailer/portion/issues/1).
- **Work:** Prioritise Ecosystem DApps; map working SDK capabilities to Middleware; confirm multiple-track eligibility and prize stacking with organiser if ambiguous; keep undeployed bridge claims out.
- **Done when:** A dated track decision links each claim to working evidence and records any unanswered organiser question.

#### POR-S04 — Publish a reproducible architecture and setup guide

- **GitHub:** [P1 · issue #4](https://github.com/Nailer/portion/issues/4)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-S01](https://github.com/Nailer/portion/issues/1).
- **Work:** Diagram browser wallet, native modules, Core, RPC, serverless API, Blob and separate issuer; distinguish trust boundaries; run fresh-install setup and disclose third-party dependencies.
- **Done when:** A new contributor follows the guide; clean install/build succeeds; diagram matches deployed components and includes no secrets.

#### POR-S05 — Produce the final three-minute demonstration

- **GitHub:** [P1 · issue #5](https://github.com/Nailer/portion/issues/5)
- **Status:** open at creation. **Lead role:** Founder + engineering.
- **Dependencies:** [POR-S01](https://github.com/Nailer/portion/issues/1), [POR-T04](https://github.com/Nailer/portion/issues/19), [POR-D03](https://github.com/Nailer/portion/issues/51).
- **Work:** Show customer problem, wallet steps, actual records, native integration, results and limitations; use historical finalized receipts when replaying evidence rather than pretending new transactions occurred. Prefer separate-user browser evidence when available; if it is not available, use the completed script receipts and explicitly disclose that limit rather than delaying eligibility or implying live signing.
- **Done when:** Public video is at most three minutes, accessible without login, and shows an understandable product flow with verified evidence.

#### POR-S06 — Prepare a fact-checked pitch deck

- **GitHub:** [P1 · issue #6](https://github.com/Nailer/portion/issues/6)
- **Status:** open at creation. **Lead role:** Founder.
- **Dependencies:** [POR-B01](https://github.com/Nailer/portion/issues/41), [POR-B03](https://github.com/Nailer/portion/issues/43), [POR-B04](https://github.com/Nailer/portion/issues/44).
- **Work:** Cover customer pain, product, why Portaldot, actual delivery, revenue hypothesis, costs, pilot status, risks and next milestones; founder supplies team and customer facts in their own words.
- **Done when:** Accessible deck separates completed work, assumptions and planned capabilities; no invented partners, traction or returns.

#### POR-S07 — Create a final release and code-freeze checklist

- **GitHub:** [P1 · issue #7](https://github.com/Nailer/portion/issues/7)
- **Status:** open at creation. **Lead role:** Engineering + founder.
- **Dependencies:** [POR-S04](https://github.com/Nailer/portion/issues/4), [POR-S05](https://github.com/Nailer/portion/issues/5), [POR-S06](https://github.com/Nailer/portion/issues/6), [POR-R07](https://github.com/Nailer/portion/issues/37).
- **Work:** Maintain meaningful incremental commits; record release commit/deployment/test evidence; verify demo and links before freeze; follow organiser process for serious post-freeze fixes.
- **Done when:** A tagged/referenced release, test manifest and final submission checklist exist before the official freeze; no late core dump or fabricated history.

### 1 — Wallet and onboarding

#### POR-W01 — Verify the real Portaldot extension flow

- **GitHub:** [P0 · issue #8](https://github.com/Nailer/portion/issues/8)
- **Status:** open at creation. **Lead role:** Engineering + wallet tester.
- **Dependencies:** [POR-S01](https://github.com/Nailer/portion/issues/1).
- **Work:** Check provider identity and official install destination; share accounts, select one, reject a request, reconnect and sign a low-cost native action; keep Portaldot first.
- **Done when:** Real extension observations and one approved finalized action are recorded. Mocked tests are not presented as real-wallet verification.

#### POR-W02 — Verify account mapping and account-switch safety

- **GitHub:** [P0 · issue #9](https://github.com/Nailer/portion/issues/9)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W01](https://github.com/Nailer/portion/issues/8).
- **Work:** Test mapped/unmapped accounts, mapping collisions, network changes and switching accounts while review is open; keep native batches flat and bind plans to the actual signer.
- **Done when:** Wrong account/network invalidates review; no local key fallback; mapping succeeds with the correct native account or fails explicitly.

#### POR-W03 — Publish an honest wallet compatibility matrix

- **GitHub:** [P1 · issue #10](https://github.com/Nailer/portion/issues/10)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W01](https://github.com/Nailer/portion/issues/8).
- **Work:** Verify each supported injected wallet separately; explain why ordinary MetaMask EVM signing cannot sign the native flow; keep EVM-only tooling separate.
- **Done when:** UI and guide list only tested support, clear prerequisites and verified install links; no recovery-phrase import is introduced.

#### POR-W04 — Add an intent-based first-use journey

- **GitHub:** [P0 · issue #11](https://github.com/Nailer/portion/issues/11)
- **Status:** open at creation. **Lead role:** Product + engineering.
- **Dependencies:** [POR-W01](https://github.com/Nailer/portion/issues/8).
- **Work:** Let visitors choose operating an asset, reviewing/funding, or inspecting the project; allow public browsing; route each role to one clear next step without creating an account.
- **Done when:** A first-time visitor identifies the product purpose, intended role and next action without help; no wallet or fabricated balance is generated.

#### POR-W05 — Show wallet and service readiness before actions

- **GitHub:** [P0 · issue #12](https://github.com/Nailer/portion/issues/12)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W01](https://github.com/Nailer/portion/issues/8), [POR-W02](https://github.com/Nailer/portion/issues/9).
- **Work:** Display actual native/payment balances, selected account, chain, contract and API readiness; distinguish zero, loading, unavailable, wrong network and missing extension.
- **Done when:** A disconnected or unfunded visitor receives the correct next action. Connection alone never implies all funding services are ready.

#### POR-W06 — Show action costs including storage deposits

- **GitHub:** [P0 · issue #13](https://github.com/Nailer/portion/issues/13)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W05](https://github.com/Nailer/portion/issues/12), [POR-F01](https://github.com/Nailer/portion/issues/54).
- **Work:** Separate purchase/bond amount, protocol fees, native execution fee, storage deposit and possible refund; estimate against current state and expire quotes when identity/state changes.
- **Done when:** Quotes show source/time and limits; unknown costs remain unknown; reviewed fees plus deposits are not described as gas alone; cap rejection never triggers an automatic higher-cap retry.

#### POR-W07 — Make faucet prerequisites and limits understandable

- **GitHub:** [P1 · issue #14](https://github.com/Nailer/portion/issues/14)
- **Status:** open at creation. **Lead role:** Engineering + founder.
- **Dependencies:** [POR-W05](https://github.com/Nailer/portion/issues/12), [POR-R04](https://github.com/Nailer/portion/issues/34).
- **Work:** Explain native tPOT versus test pUSD, official allocation path, daily reset, service reserve and failed requests; link to verified organiser instructions.
- **Done when:** User can tell which token is missing and how to obtain it; hosted native faucet stays disabled and deployer funds are never automatically distributed.

#### POR-W08 — Save an unsigned listing draft without secrets

- **GitHub:** [P1 · issue #15](https://github.com/Nailer/portion/issues/15)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W04](https://github.com/Nailer/portion/issues/11).
- **Work:** Preserve form progress, validate photo and input limits, show a summary before signing and warn if uploaded public data should not be shared; exclude wallet secrets.
- **Done when:** Refresh restores a draft with an explicit save/clear policy; changing a wallet does not silently change operator identity; nothing is published without approval.

### 2 — Transaction reliability

#### POR-T01 — Make transaction states and finality unambiguous

- **GitHub:** [P0 · issue #16](https://github.com/Nailer/portion/issues/16)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W02](https://github.com/Nailer/portion/issues/9), [POR-W06](https://github.com/Nailer/portion/issues/13).
- **Work:** Expose preparing, awaiting wallet, submitted, included, finalized, rejected, failed and unconfirmed states; prevent duplicate clicks and keep completed receipts visible.
- **Done when:** Rejection, dropped/usurped transaction and delayed finality are distinguishable; only a successful finalized receipt is called successful.

#### POR-T02 — Resume partial document uploads safely

- **GitHub:** [P0 · issue #17](https://github.com/Nailer/portion/issues/17)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-T01](https://github.com/Nailer/portion/issues/16).
- **Work:** Persist accepted content hashes and finalized anchors; retry only missing document publication; revalidate allocated identifiers before later creation; retain completed upload receipts.
- **Done when:** Terms success/photo failure and pin failure recover without duplicate stores or listing creation; changed IDs require rebuilding and reviewing immutable terms.

#### POR-T03 — Reconcile unknown outcomes before retrying

- **GitHub:** [P0 · issue #18](https://github.com/Nailer/portion/issues/18)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-T01](https://github.com/Nailer/portion/issues/16).
- **Work:** Retain public action identifiers, signer/network identity and known hashes; inspect finalized history/catalog/nonce as appropriate; expose publication-only retry when chain execution succeeded.
- **Done when:** A timeout or refresh cannot blindly resubmit an already successful money-moving action. Recovery is demonstrated without additional duplicate spending.

#### POR-T04 — Build a receipt and history centre

- **GitHub:** [P1 · issue #19](https://github.com/Nailer/portion/issues/19)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-T01](https://github.com/Nailer/portion/issues/16), [POR-R01](https://github.com/Nailer/portion/issues/31).
- **Work:** Show action, actor, finalized block/hash, status, actual amounts and known fee data; support copy, verified explorer links where available, and export.
- **Done when:** History reconciles with contract totals, labels incomplete coverage, and offers useful recovery paths without exposing signing material.

#### POR-T05 — Exercise rejection and interruption scenarios

- **GitHub:** [P0 · issue #20](https://github.com/Nailer/portion/issues/20)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W02](https://github.com/Nailer/portion/issues/9), [POR-T01](https://github.com/Nailer/portion/issues/16).
- **Work:** Test rejection at every signing step, account/network change, API failure after finalization, tab refresh and double-click; preserve the current wallet rather than substituting identities.
- **Done when:** A recorded scenario matrix proves no false success, key fallback or unintended repeat transaction; regressions protect material failure paths.

#### POR-T06 — Fix sold-out, connecting and unavailable action states

- **GitHub:** [P0 · issue #21](https://github.com/Nailer/portion/issues/21)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W04](https://github.com/Nailer/portion/issues/11), [POR-T01](https://github.com/Nailer/portion/issues/16).
- **Work:** Replace stale undeployed messages during loading/outages; clearly explain sold-out offers and unavailable pools; separate user-owned shares from stake and sale inventory.
- **Done when:** The existing test offer is honestly shown as sold out, not broken; loading does not assert the deployed contract is absent; unsupported actions are not advertised as ready.

#### POR-T07 — Prove the browser flow with separate operator and participant accounts

- **GitHub:** [P1 · issue #22](https://github.com/Nailer/portion/issues/22)
- **Status:** open at creation. **Lead role:** Engineering + two wallet testers.
- **Dependencies:** [POR-W01](https://github.com/Nailer/portion/issues/8), [POR-W02](https://github.com/Nailer/portion/issues/9), [POR-T02](https://github.com/Nailer/portion/issues/17), [POR-T03](https://github.com/Nailer/portion/issues/18), [POR-F01](https://github.com/Nailer/portion/issues/54).
- **Work:** Prepare a bounded plan, funded native accounts and approved test-token source; perform website approvals and reconcile balances; reuse existing assets for share/stake checks where possible and label historical creation separately.
- **Done when:** Actual separate-account browser results are recorded. No extra listing or live write occurs without a costed budget; script evidence and browser evidence remain distinct.

### 3 — Operator and participant tools

#### POR-O01 — Add an operator and asset evidence checklist

- **GitHub:** [P1 · issue #23](https://github.com/Nailer/portion/issues/23)
- **Status:** open at creation. **Lead role:** Product + engineering.
- **Dependencies:** [POR-B01](https://github.com/Nailer/portion/issues/41).
- **Work:** Record operator identity/source, equipment documents, business revenue source, schedule, verifier, date and review state; distinguish self-reported, hash-checked and independently checked evidence.
- **Done when:** Every badge states who checked what and when; blockchain presence is never represented as independent physical or legal verification.

#### POR-O02 — Improve image quality and verify photo integrity

- **GitHub:** [P1 · issue #24](https://github.com/Nailer/portion/issues/24)
- **Status:** open at creation. **Lead role:** Design + engineering.
- **Dependencies:** [POR-W08](https://github.com/Nailer/portion/issues/15).
- **Work:** Validate size/type, preserve useful resolution when compressing, preview the exact bytes, verify content hash/availability independently of terms, and provide accessible fallbacks.
- **Done when:** New uploads are legible on desktop/mobile within limits; a failed photo has its own state. Existing immutable low-resolution test media is not silently replaced with different bytes.

#### POR-O03 — Make the operator workspace actionable

- **GitHub:** [P1 · issue #25](https://github.com/Nailer/portion/issues/25)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W04](https://github.com/Nailer/portion/issues/11), [POR-O01](https://github.com/Nailer/portion/issues/23).
- **Work:** Show each asset, funding status, available sale inventory, bond, payment deadline, deposits and next action using chain-backed data; surface overdue/defaulted items.
- **Done when:** An operator can determine what needs attention and reach deposit/top-up/closure actions without navigating developer tools; missing counters stay unavailable.

#### POR-O04 — Explain actual deposits and payment-clock behaviour

- **GitHub:** [P1 · issue #26](https://github.com/Nailer/portion/issues/26)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-R01](https://github.com/Nailer/portion/issues/31).
- **Work:** Show gross deposit, actual fee, net allocation and qualifying status; distinguish the initial payment window from an actual payment and projected income from paid income.
- **Done when:** The 1 test-pUSD deposit reconciles to 0.005 fee and 0.995 allocation; timestamps never imply payment when only listing initialization occurred.

#### POR-O05 — Export useful funding and payment reports

- **GitHub:** [P1 · issue #27](https://github.com/Nailer/portion/issues/27)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-T04](https://github.com/Nailer/portion/issues/19), [POR-O04](https://github.com/Nailer/portion/issues/26).
- **Work:** Export verified receipts, amounts, currency/decimals, period and account identifiers; include coverage and testnet labels; retain exact source units and usable timestamps.
- **Done when:** CSV/report totals match included receipts, disclose exclusions and do not invent complete accounting or customer revenue.

#### POR-O06 — Explain default, bond recovery and exit

- **GitHub:** [P1 · issue #28](https://github.com/Nailer/portion/issues/28)
- **Status:** open at creation. **Lead role:** Product + engineering.
- **Dependencies:** [POR-R06](https://github.com/Nailer/portion/issues/36).
- **Work:** Explain cadence, overdue/default states, slashing, top-up, wind-down, unstaking, selling and bond limits; distinguish return of shares from repayment of purchase money.
- **Done when:** A user can explain how they might exit, what happens if there is no buyer, and why a bond does not insure their full capital; controls match deployed rules.

#### POR-O07 — Make discovery honest and useful

- **GitHub:** [P1 · issue #29](https://github.com/Nailer/portion/issues/29)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W04](https://github.com/Nailer/portion/issues/11), [POR-O01](https://github.com/Nailer/portion/issues/23).
- **Work:** Filter/search actual catalog entries; visibly label the authorized test listing and completed offer; show unavailable data correctly; avoid mixing illustrative graphics with asset evidence.
- **Done when:** No generated business listings, invented totals or automatic opening balances appear; test records cannot be mistaken for genuine financed equipment.

#### POR-O08 — Clarify portfolio ownership, stake and claims

- **GitHub:** [P1 · issue #30](https://github.com/Nailer/portion/issues/30)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-T04](https://github.com/Nailer/portion/issues/19), [POR-O04](https://github.com/Nailer/portion/issues/26), [POR-O06](https://github.com/Nailer/portion/issues/28).
- **Work:** Separate owned shares, earning stake, pending deposited income and previously claimed income; keep claims visible after zero stake; explain stake/unstake effects.
- **Done when:** Balances match native assets and Core state, including zero-stake pending claims; no projected return is displayed as money already earned.

### 4 — Reliability and security

#### POR-R01 — Define receipt coverage and reconcile history

- **GitHub:** [P0 · issue #31](https://github.com/Nailer/portion/issues/31)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-S01](https://github.com/Nailer/portion/issues/1).
- **Work:** Maintain honest partial coverage for app-published receipts; reconcile totals and imports; specify an archive-backed full-index path only if available; paginate Blob listings.
- **Done when:** Externally submitted transactions cannot silently become zero income or disappear behind a complete-history claim; pagination and reconciliation are tested.

#### POR-R02 — Prove document durability and recovery

- **GitHub:** [P1 · issue #32](https://github.com/Nailer/portion/issues/32)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-R01](https://github.com/Nailer/portion/issues/31).
- **Work:** Back up immutable verified bytes and anchors; test recovery after native retention expires and storage/API outages; document any renewal service separately with its own budget.
- **Done when:** Hash-verified documents remain recoverable after a restart/restore test; renewal is not promised unless running and monitored; missing bytes never receive substitute content.

#### POR-R03 — Verify read consistency and stale-quote handling

- **GitHub:** [P0 · issue #33](https://github.com/Nailer/portion/issues/33)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W06](https://github.com/Nailer/portion/issues/13), [POR-T01](https://github.com/Nailer/portion/issues/16).
- **Work:** Use clearly identified finalized snapshots where needed; enforce genesis/code/payment-asset identity; refresh sale inventory, allowance and balances before signing.
- **Done when:** A stale listing/quote or mismatched chain/code fails safely and prompts a new review; no configured payment asset is silently substituted.

#### POR-R04 — Harden concurrent faucet requests and issuer spending

- **GitHub:** [P0 · issue #34](https://github.com/Nailer/portion/issues/34)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-F01](https://github.com/Nailer/portion/issues/54).
- **Work:** Review atomic account/day claims, global quota races, issuer nonce serialization, rate limits, ambiguous mint recovery and gas reserve enforcement; load-test with isolated fixtures.
- **Done when:** Concurrent requests cannot duplicate grants or accidentally exceed the defined service budget; no deployment key is used; unknown mint outcomes are reconciled before retry.

#### POR-R05 — Triage and patch dependency advisories

- **GitHub:** [P0 · issue #35](https://github.com/Nailer/portion/issues/35)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** None.
- **Work:** Reproduce the reported Zod advisory chain through Blob/OIDC/CLI configuration, inspect runtime reachability, choose a compatible fix, regenerate a clean lockfile and rerun relevant checks.
- **Done when:** Record affected versions, fix or justified mitigation, clean-install/build results and remaining advisories; do not apply blind force upgrades or assume a passing audit proves safety.

#### POR-R06 — Review contract and native-backing boundaries

- **GitHub:** [P1 · issue #36](https://github.com/Nailer/portion/issues/36)
- **Status:** open at creation. **Lead role:** Engineering + independent reviewer.
- **Dependencies:** None.
- **Work:** Review direct callers bypassing web checks, supported token identities, existing default guards, bond solvency, malicious callbacks, native fractionalization lock and who can burn/redeem a deed. Explicitly assess direct-to-operator purchase transfers and missing spending controls. Design, without deploying, funding escrow/targets/deadlines, vendor or milestone release, independent approval, refunds/disputes and accountable collections; keep custody/eligibility review in B06/B07.
- **Done when:** An adversarial review maps each protection to contract, runtime, web or business process; deployed protections remain covered; any new bytecode needs a separately approved migration budget. Current limits and proposed controls are visibly separate; no purchase-money escrow or regulatory protection is claimed for Core v1. A proposed release model identifies approvers, evidence, conflicts, costs and failure cases before any new bytecode or real-money use.

#### POR-R07 — Add reproducible continuous checks and release evidence

- **GitHub:** [P0 · issue #37](https://github.com/Nailer/portion/issues/37)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-R05](https://github.com/Nailer/portion/issues/35).
- **Work:** Run relevant contract, SDK, server, web, type and build checks in CI; protect secrets; verify a clean lockfile install and meaningful regressions; record skipped live tests honestly.
- **Done when:** A contributor can reproduce the checks and identify the release commit; failures block release without spending faucet tokens automatically.

#### POR-R08 — Reduce initial load and measure mobile performance

- **GitHub:** [P1 · issue #38](https://github.com/Nailer/portion/issues/38)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-W04](https://github.com/Nailer/portion/issues/11).
- **Work:** Split optional routes and heavy SDK imports, defer advanced tooling and avoid blocking the homepage on RPC; measure before/after on a representative mobile profile.
- **Done when:** A recorded baseline and improved startup measurement exist; key routes still work and visual polish is preserved; no arbitrary score is claimed without measurement.

#### POR-R09 — Define hosting, backup, secret and incident operations

- **GitHub:** [P1 · issue #39](https://github.com/Nailer/portion/issues/39)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-R02](https://github.com/Nailer/portion/issues/32), [POR-R04](https://github.com/Nailer/portion/issues/34).
- **Work:** Document production configuration and permissions, issuer rotation, separate service budgets, storage/hosting limits, health monitoring, rollback and restoration.
- **Done when:** A recovery drill restores verified data; no deployer secret is hosted or committed; an operator knows how to disable a failing service and investigate safely.

#### POR-R10 — Handle RPC/API latency and outages professionally

- **GitHub:** [P1 · issue #40](https://github.com/Nailer/portion/issues/40)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-R01](https://github.com/Nailer/portion/issues/31), [POR-R02](https://github.com/Nailer/portion/issues/32).
- **Work:** Bound requests, clean up subscriptions, expose retryable read states and partial service readiness, prevent noisy retry loops and distinguish stale data from current observations.
- **Done when:** RPC disconnect, missing Blob data, non-JSON response and function timeout show a useful state without fabricated data or automatic transaction resubmission.

### 5 — Business validation

#### POR-B01 — Interview reachable operators and identify the paid problem

- **GitHub:** [P0 · issue #41](https://github.com/Nailer/portion/issues/41)
- **Status:** open at creation. **Lead role:** Founder.
- **Dependencies:** None.
- **Work:** Speak with the solar operator and the other reachable group; ask about the last actual funding/payment/reporting problem, current tools, time/cost and evidence-sharing permissions.
- **Done when:** Dated notes distinguish observed pain, willingness to share data and objections; no contact or partnership is claimed merely because the founder can reach the company.

#### POR-B02 — Agree a small testnet pilot with a real operator

- **GitHub:** [P1 · issue #42](https://github.com/Nailer/portion/issues/42)
- **Status:** open at creation. **Lead role:** Founder + operator.
- **Dependencies:** [POR-B01](https://github.com/Nailer/portion/issues/41), [POR-B03](https://github.com/Nailer/portion/issues/43), [POR-B06](https://github.com/Nailer/portion/issues/46).
- **Work:** Define one operator, permitted non-sensitive asset information, roles, success measures, timeline and consent; keep actual money and public claims outside the testnet pilot.
- **Done when:** A specific pilot agreement or clear refusal is retained; operator-approved information is not uploaded publicly without permission.

#### POR-B03 — Validate the actual asset cash-flow story

- **GitHub:** [P0 · issue #43](https://github.com/Nailer/portion/issues/43)
- **Status:** open at creation. **Lead role:** Founder + operator.
- **Dependencies:** [POR-B01](https://github.com/Nailer/portion/issues/41).
- **Work:** Inspect permitted equipment costs, collections, operating costs, bond affordability, proposed payment schedule and capital/exit expectations; distinguish records from illustrative arithmetic.
- **Done when:** An operator-approved example shows where funder payments could come from, funding shortfalls and downside cases; no returns or repayment guarantee is inferred.

#### POR-B04 — Test pricing and willingness to pay

- **GitHub:** [P1 · issue #44](https://github.com/Nailer/portion/issues/44)
- **Status:** open at creation. **Lead role:** Founder.
- **Dependencies:** [POR-B01](https://github.com/Nailer/portion/issues/41), [POR-B03](https://github.com/Nailer/portion/issues/43).
- **Work:** Present funding administration, reporting and payout-management options; distinguish deployed 1% sale/0.5% deposit fees from unimplemented subscription/onboarding hypotheses.
- **Done when:** At least one specific price/offer receives a documented accept, reject or conditional response; interest is not reported as paying revenue.

#### POR-B05 — Calculate viable cost per operator and offering

- **GitHub:** [P1 · issue #45](https://github.com/Nailer/portion/issues/45)
- **Status:** open at creation. **Lead role:** Founder + engineering.
- **Dependencies:** [POR-B03](https://github.com/Nailer/portion/issues/43), [POR-B04](https://github.com/Nailer/portion/issues/44), [POR-F01](https://github.com/Nailer/portion/issues/54).
- **Work:** Include support, acquisition, verification, legal/payment providers, storage, hosting, collections and failed transactions; separate refundable locks, user funds and company income.
- **Done when:** A scenario model with labelled assumptions shows contribution at realistic volumes and identifies a viable fee/minimum deal size or a reason the model fails.

#### POR-B06 — Define rights, obligations and eligible real-money users

- **GitHub:** [P1 · issue #46](https://github.com/Nailer/portion/issues/46)
- **Status:** open at creation. **Lead role:** Founder + qualified adviser.
- **Dependencies:** [POR-B01](https://github.com/Nailer/portion/issues/41), [POR-B03](https://github.com/Nailer/portion/issues/43).
- **Work:** For a first permitted market, obtain qualified review of equipment ownership, offering rights, custody, agreements, identity, transfers, disputes, default and exit; document global expansion constraints.
- **Done when:** A reviewed operating model states who owes what and who may participate; testnet records are never treated as sufficient legal ownership or universal approval.

#### POR-B07 — Design real collections, payouts and custody responsibility

- **GitHub:** [P2 · issue #47](https://github.com/Nailer/portion/issues/47)
- **Status:** open at creation. **Lead role:** Founder + engineering.
- **Dependencies:** [POR-B02](https://github.com/Nailer/portion/issues/42), [POR-B06](https://github.com/Nailer/portion/issues/46).
- **Work:** Choose who collects customer income, converts currency if needed, holds funds, reconciles records and pays funders; evaluate eligible payment providers only when requirements are known.
- **Done when:** A feasible supported payment path and responsible parties are documented before implementation; no synthetic bank integration or unsupported global cash-out promise.

#### POR-B08 — Make an evidence-based continue-or-adjust decision

- **GitHub:** [P1 · issue #48](https://github.com/Nailer/portion/issues/48)
- **Status:** open at creation. **Lead role:** Founder.
- **Dependencies:** [POR-B01](https://github.com/Nailer/portion/issues/41), [POR-B03](https://github.com/Nailer/portion/issues/43), [POR-B04](https://github.com/Nailer/portion/issues/44), [POR-B05](https://github.com/Nailer/portion/issues/45).
- **Work:** Evaluate demand, evidence quality, operator economics and willingness to pay; if funding is unsuitable but reporting/payout administration is valuable, evaluate that narrower product.
- **Done when:** A written decision names supporting evidence, failed assumptions and next experiment; marketplace expansion is not justified by development effort already spent.

### 6 — Design and communication

#### POR-D01 — Polish the existing brand and visual hierarchy

- **GitHub:** [P1 · issue #49](https://github.com/Nailer/portion/issues/49)
- **Status:** open at creation. **Lead role:** Design + engineering.
- **Dependencies:** [POR-W04](https://github.com/Nailer/portion/issues/11), [POR-O02](https://github.com/Nailer/portion/issues/24).
- **Work:** Retain a consistent logo, color, type and spacing system; fix low-quality new media handling, dropdown alignment, form layouts and understandable primary actions.
- **Done when:** Homepage explains who Portion serves and what to do; asset evidence stays distinguishable from decorative illustrations; desktop/mobile screenshots show consistent quality.

#### POR-D02 — Make motion, mobile and accessibility support the task

- **GitHub:** [P1 · issue #50](https://github.com/Nailer/portion/issues/50)
- **Status:** open at creation. **Lead role:** Design + engineering.
- **Dependencies:** [POR-D01](https://github.com/Nailer/portion/issues/49), [POR-T01](https://github.com/Nailer/portion/issues/16).
- **Work:** Use purposeful transitions for steps, approvals and feedback; honor reduced motion; test keyboard/focus, contrast, errors and narrow layouts on key journeys.
- **Done when:** Key flows work without animation or a mouse, dialogs preserve focus, controls have useful labels and no essential content overflows the tested mobile widths.

#### POR-D03 — Run first-time-user usability sessions

- **GitHub:** [P1 · issue #51](https://github.com/Nailer/portion/issues/51)
- **Status:** open at creation. **Lead role:** Founder + product.
- **Dependencies:** [POR-W04](https://github.com/Nailer/portion/issues/11), [POR-T06](https://github.com/Nailer/portion/issues/21).
- **Work:** Ask new users to explain the product, inspect an asset, understand costs and find operator/funder actions; observe confusion rather than teaching through the test.
- **Done when:** Dated observations and fixes show users can identify purpose and next actions; number of participants and limits are disclosed rather than claiming broad usability proof.

#### POR-D04 — Prepare evidence-based marketing and judge journeys

- **GitHub:** [P1 · issue #52](https://github.com/Nailer/portion/issues/52)
- **Status:** open at creation. **Lead role:** Founder + engineering.
- **Dependencies:** [POR-S01](https://github.com/Nailer/portion/issues/1), [POR-S05](https://github.com/Nailer/portion/issues/5), [POR-B01](https://github.com/Nailer/portion/issues/41).
- **Work:** Lead with the paid problem and working testnet flow; provide short role-specific guidance and a verifiable evidence trail; distinguish self-funded test activity from customers.
- **Done when:** Every capability/traction claim is supported or labelled planned; founder approves external messages and destinations before anything is sent or posted.

#### POR-D05 — Measure product friction with a privacy-conscious plan

- **GitHub:** [P2 · issue #53](https://github.com/Nailer/portion/issues/53)
- **Status:** open at creation. **Lead role:** Product + engineering.
- **Dependencies:** [POR-D03](https://github.com/Nailer/portion/issues/51).
- **Work:** Define completion, abandonment, failure and support metrics; prefer consented observations first and collect no keys, recovery words or unnecessary wallet-linked identity.
- **Done when:** A measurement plan states purpose, retention and consent; any implemented analytics are tested and actual observations are separated from targets.

### 7 — Scope and token discipline

#### POR-F01 — Maintain an explicit native-token budget and reserve

- **GitHub:** [P0 · issue #54](https://github.com/Nailer/portion/issues/54)
- **Status:** open at creation. **Lead role:** Engineering + founder.
- **Dependencies:** None.
- **Work:** Refresh actual balances before any write; budget fees, storage, refunds and failure costs by action; record service wallets separately; use existing receipts/read-only checks before repeating creation.
- **Done when:** Every new live test has a reviewed cap and remaining reserve. Last verified 44.82920824 tPOT is labelled a dated balance; no new deployment, faucet request or chain write is implied by this backlog.

#### POR-F02 — Document protocol cost limits and funded-account prerequisites

- **GitHub:** [P1 · issue #55](https://github.com/Nailer/portion/issues/55)
- **Status:** open at creation. **Lead role:** Engineering.
- **Dependencies:** [POR-F01](https://github.com/Nailer/portion/issues/54), [POR-R06](https://github.com/Nailer/portion/issues/36).
- **Work:** Explain why testnet deposits are high; preserve the 32-byte hash saving; measure per-listing/participant costs without stripping protections; plan separate funded tester accounts through official channels.
- **Done when:** Costs are reproducible and distinguish caps from charges; ordinary users know native funds are required; any extra token request is truthful and explicitly authorized.

#### POR-F03 — Gate bridge, node-tool and keeper expansion

- **GitHub:** [P2 · issue #56](https://github.com/Nailer/portion/issues/56)
- **Status:** open at creation. **Lead role:** Product + engineering.
- **Dependencies:** [POR-S03](https://github.com/Nailer/portion/issues/3), [POR-B08](https://github.com/Nailer/portion/issues/48).
- **Work:** Keep unproven bridge, pools, automated slashing/renewal/compounding and complete archive indexing out of the primary promise; define a customer or award-evidence gate for each later project.
- **Done when:** Advanced pages state actual readiness; no new deployment or spend is scheduled merely to claim more tracks; core usability remains the priority.

## Completion rules

Close an issue only with its acceptance evidence: commit and test record, actual finalized transaction, observed browser result, customer response or founder submission confirmation as appropriate. A merged UI change is not business validation. A script test is not browser signing. An uploaded document is not a created listing. A proposed fee is not income. Preserve dated evidence and update issue dependencies when scope changes.

Before any real-money launch, the rights/eligibility, custody/payment, operating and independent security gates must be addressed. These are a later release gate, not a suggestion to simulate compliance for the hackathon.
