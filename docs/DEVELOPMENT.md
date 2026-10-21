# Portion development stages

The product: operators raise funding for productive assets; participants buy shares and claim allocations of deposited revenue. Testnet software, with an explicitly labelled simulation.

## Stage 1 — first impression and orientation (implemented)

Deliver an understandable homepage, a consistent visual direction, focused navigation, a share-price preview, searchable/filterable asset cards, and accurate connection/empty/error states. Keep the homepage visible before the chain connects. Use the existing backend rather than invented live activity. Motion supports orientation and interaction; honour reduced-motion settings.

Exit checks: TypeScript, production build, desktop/mobile visual review, category/search interactions, simulated purchase path and portfolio navigation. This stage does not establish production readiness or fix contract economics.

## Stage 2 — business model and correctness (implemented)

Use the global operator-infrastructure direction in BUSINESS.md and validate company pricing with the reachable solar operator. Add an honest business calculator, keeping proposed fees distinct from actual charges.

Resolve the wind-down/slashing escape: closing a listing must not erase existing default obligations. For this prototype, block winding down while any earning shares are staked; require defaulted bonds to be settled before closure. This is conservative and can keep operator collateral locked until participants unstake. Unstaking does not repay the purchase price; a production settlement/repayment model remains to be designed. Add adversarial regression coverage. Review contract and simulation parity, including operator-only clock resets, stale prepared transactions, and validation of amounts. Rebuild SDK artifacts after contract changes.

Exit checks: contract tests covering default → wind-down → settlement/bond release, SDK tests, simulation parity checks. No claims of guaranteed returns or legal physical title.

## Stage 3 — complete the main journeys (implemented; live verification pending)

Extend the visual system to listing details, share selection and purchase, wallet onboarding, portfolio and claims, asset creation, and operator payments. Make pending/success/failure, fees, fund flow, payment cadence and risks clear. Tools remain available as supporting features.

Exit checks: full assisted operator → buyer → deposit → claim lifecycle, insufficient-balance and rejected-transaction paths, keyboard and mobile review. Testnet and simulation are visibly distinct.

## Stage 4 — deployment readiness (in progress; funding blocked)

Confirm deployment estimates against the current runtime and available balance. The last observed native testnet balance was 500 tPOT; historical budget notes estimated about 2,000 tPOT. Do not assume that estimate is current or deploy until the funding and configuration are checked. Deploy, seed, and run real native/EVM end-to-end flows once ready; retain transaction evidence. Never regenerate existing keys.

Exit checks: deployed addresses, finalized transactions, document retrieval and deed checks, keeper behaviour, accurate UI balances. Assess bridge separately before presenting it as proven.

## Stage 5 — polish and judging

Complete responsive, accessibility, motion and performance review across routes. Prepare a concise demo around the core user journey and real testnet evidence. Document remaining trust assumptions and operational limits. Prioritise Ecosystem DApps and overall judging quality; multiple-track award stacking is not established by published rules.

## Product validation alongside development

Find one operator partner and one equipment category. Validate payment records, collections, investor rights, servicing costs, and onboarding/funding/payout options. Determine applicable legal arrangements before accepting real investment funds. Software development alone does not validate demand.

## Stage 1 validation record

- Baseline: `npm run typecheck` passed across scripts, SDK, server and web.
- Baseline: `npm test` passed 43 contract tests and 12 SDK unit tests; four live tests were skipped.
- Browser review at the available 511 px viewport: hero, illustration, asset preview, navigation and search/empty states inspected.
- Share preview: 25 shares displayed 300 simulated pUSD and carried the selection into the listing purchase form.
- Category + search: Mobility + “solar” showed zero matches; Clear filters restored four simulated assets.
- Simulated purchase: 10 shares cost 120 pUSD, cash changed from 2,000 to 1,880, and Portfolio showed 10 shares valued at the 120 pUSD sale price. No real transaction was submitted.
- Production build passed. Vite reports the existing mixed static/dynamic import for backend.ts; bundle splitting remains a later performance task.
- Desktop visual QA, full-route styling, live transactions, contract fixes and simulation-parity corrections remain outstanding; the screenshot is the mobile review, not proof of those checks.


## Stage 2 implementation notes

- Added a global business direction and pilot/stop criteria in BUSINESS.md. The founder can reach a solar operator company and another group; no partner agreement or customer revenue has been established.
- Added /business with editable costs and fee assumptions, showing operator, funder and Portion cash flows. A proposed management fee is zero by default and is not charged by the contract.
- Blocked contract wind-down with active stakes and with an unsettled default; blocked new stakes and bond top-ups after closure. Existing earned revenue claims survive closure. SDK artifacts rebuilt.
- Simulation now enforces operator permissions, qualifying operator-only clock resets, balance/amount checks, closing rules and stale/duplicate confirmation protection. Sale/deposit fees and sale proceeds are credited in the simulated ledger.
- Regression tests cover attempts to bypass bond protection, post-close staking, preserved claims, unauthorized operator actions, invalid amounts and stale/duplicate submissions. Web regression tests now run under npm test.
- These changes do not implement principal repayment, legally enforceable equipment ownership, production wallet security, real payment attestations or subscription billing. Stage 3 will build the detailed operator and funder experience around these explicit limits.

### Stage 2 validation and remaining work

- Contract suite: 46 passing tests, including new adversarial close/default/stake cases and 512 solvency fuzz runs.
- SDK: 12 unit tests passed; 4 live tests skipped.
- Web: 8 simulation regression tests passed, including sale proceeds, treasury fees and funder allocation checks.
- Project-wide typecheck and the production web build passed.
- Browser calculator checks: default operator cash $300/month; funders receive $497.50/month; Portion contribution -$22.50/month and -$420 in year one with the stated costs. A hypothetical $50 management fee changes Portion contribution to $27.50/month and $180 in year one. This is not billing or a recommended validated price.
- Reviewed the calculator at the available mobile viewport. Desktop visual QA remains outstanding.
- Dependency audit reports existing high/critical development-tool advisories affecting Vite/Vitest/tinypool. Refresh and revalidate the toolchain before public hosting. The local development server is bound to loopback; no public deployment was performed.
- Fixed only the documented simulation mismatches; this is not an exhaustive audit. Legal settlement, repayment/exit design and real payment evidence remain product requirements.


## Stage 3 delivery and validation

Implemented:

- Operator workspace at /operator: owned assets, gross primary funding, revenue/bond allocations, bond balances, search and attention filters, payment deadlines and revenue-deposit review. Data comes from the selected backend; no invented live totals.
- Funder portfolio: account-specific holdings, reference share values, available test balance, pending claims, claim-all, unstaked shares and recent indexed activity. The reference value is not a resale quote.
- Four-step creation: asset, funding, payments and review, with validation, estimated fees/net proceeds, separate bond cost and an optional demo example.
- Separate in-memory simulation Operator/Funder accounts, never substituted into live transactions. Mode switching and role switching are disabled during an open transaction review. The demo wallet and assets reset on reload; the chosen simulation mode is remembered.
- Simplified confirmations and wallet introduction, progressive disclosure of technical steps, clearer payment illustrations, responsive workspace surfaces, hover/entry/progress/chart motion and reduced-motion support.

Automated checks: npm test passed 46 contract tests, 12 SDK unit tests and 12 web regression tests (70 total); four live SDK tests skipped. Project-wide typecheck and production web build passed. No contracts changed in this stage.

Production-build browser walkthrough at 511 px:

1. Selected the demo operator. Empty creation form blocked progression and showed the missing name/terms.
2. Filled the solar example, advanced through all four steps, reviewed the 1,000 pUSD maximum offering, 990 estimated net proceeds, 20 pUSD weekly deposit and separate 50 pUSD bond, then published.
3. Switched to the separate funder and bought 10 shares for 100 pUSD. The operator received 99 after the sale fee; funder cash became 1,900.
4. Operator workspace showed one asset, 100 gross funding, 10 earning shares and a 50 bond. A 1 pUSD payment showed that it would not reset the deadline; an unaffordable payment was disabled.
5. Reviewed and deposited 20 pUSD. The fee was 0.1 and the funder allocation 19.9.
6. Switched to funder Portfolio, claimed 19.9, verified cash of 1,919.9 and zero pending income. Operator history showed purchase, deposit and claim.

Outstanding: desktop visual QA, exhaustive accessibility/browser review, real payment evidence, production settlement/repayment design, secure production wallet handling, and the dependency refresh already noted above. The contract cadence starts at listing creation, including before funding; revisit this policy before accepting real funds. No live funds moved and no public deployment occurred.

Next stage: refresh development dependencies, recheck deployment costs/current balance against the live runtime, then deploy and verify the core lifecycle on testnet if funding allows. Preserve existing keys.


## Stage 4 progress — 21 October

- Rechecked the official DoraHacks details. Check-in is 24 October 13:00 Lagos, final freeze 6 November 05:00 Lagos. Added HACKATHON-READINESS.md with judging alignment, primary/secondary track fit, requirements and actual gaps.
- Upgraded Vite to 8.3.5, React plugin to 6.1.2, Vitest to 5.0.5 throughout, and React Router DOM to 7.18.4. npm audit now reports zero known vulnerabilities; this is not a security audit.
- Read-only live tests initially exposed a false fallback-address assumption for registered H160 accounts. Added runtime-based resolution to the SDK and faucet, canonical native addresses for faucet cooldowns, and fail-closed behaviour if the mapping cannot be read. Added four regression tests. All four read-only live checks now pass.
- Added core-only deployment and a read-only, machine-readable budget report. Failed/reverted constructor simulations block deployment. Successful deployment steps are checkpointed, and incomplete checkpoints are not exposed as a ready deployment. No transactions were submitted.
- At finalized block 135025, the deployer had 500 tPOT spendable. Core budget: 1,252.25 tPOT including deposit margin and a 40 tPOT operating buffer; shortfall 752.25. Core plus home bridge: 1,754.968125 tPOT; shortfall 1,254.968125. These estimates do not fully fund seed/e2e accounts or BNB-side gas. A practical additional request of 1,500 tPOT would leave some room beyond the combined estimate, subject to rechecking before deployment.
- Saved preflight, dependency audit, live network snapshot and check manifest in deployments/. None is labelled as a deployment or full-lifecycle transaction report.
- Checks: 76 local tests passed (46 contract, 12 SDK, 14 web, 4 server); an additional live run passed all 12 SDK unit tests and four live read-only checks. Project typecheck and Vite production build passed.
- API health returned ok=true and deployed=false on live Portaldot. API binds to loopback by default and was started with keepers disabled, so this readiness check cannot trigger automated onchain keeper actions.
- Checked the refreshed homepage/operator/create routes and simulation-role switching in a separate 1280×720 browser viewport. Earlier mobile walkthrough remains recorded above. The user's review tab was left intact.

Remaining before live proof: resolve the fixed 500 tPOT deployment budget through measured optimisation and/or confirmed organiser support, then deploy core and run the native/EVM lifecycle before recording real addresses/hashes. Additional funding is not assumed. Git remote/publication, final video and pitch deck are also outstanding in the submission checklist.

## Stage 5 — preserve the fixed test-token budget

- Server spending services are now explicit opt-ins. Faucet and keepers no longer inherit the deployment mnemonic. They require their own operational keys as well as `FAUCET=on` / `KEEPERS=on`. The bridge relayer requires `RELAYER=on`. Existing environment files with deployment keys alone cannot enable these services. No existing key was replaced.
- Isolated compiler experiments compared the existing optimiser with disabled inlining and minimal Yul optimisation; both alternatives increased bytecode size and were rejected.
- Changed listing initialisation to write directly into a new storage entry, preserving metadata, share terms, cadence, bond accounting and existing financial protections. Runtime bytecode fell from 12,058 to 11,504 bytes (4.59%). SDK deployment artifacts were rebuilt. Extended the existing listing test to verify the complete stored terms and initial state.
- Live read-only constructor simulation at finalized block 135580 passed. Portion storage deposit fell from 969 to 925.788 tPOT. Core budget including margin and the existing 40 tPOT operating buffer fell from 1,252.25 to 1,198.235 tPOT. This remains above the fixed 500 allocation; optimisation has not solved deployment funding. No transactions were submitted; balance remained 500 tPOT.
- All 79 local tests passed: 46 contracts (including 512 solvency fuzz runs), 12 SDK, 14 web, 7 server. Four opt-in live SDK tests were skipped by the standard local test command. The constructor estimate above was checked separately against the live runtime.

Next: investigate a substantially smaller deployment architecture or the organiser's intended deployment/funding path. Do not remove bond/claim protections or claim testnet deployment to make the budget appear solved. The polished simulation remains available while this is resolved.

## Stage 6 — publish the reviewable prototype

- Preserved the 12 existing commits and grouped previously uncommitted work into feature/fix commits dated 21 October, without backdating or recreating earlier work. Published the public repository at https://github.com/Nailer/portion.
- Published the frontend at https://portion-one.vercel.app in `pleasants-projects/portion`. New visitors start in labelled simulation; saved choices and explicit `?demo` / `?live` links are respected. The API, indexer and spending jobs are not hosted by this frontend deployment.
- Added an in-app first-visit guide plus WALKTHROUGH.md with separate funder, operator and judge instructions. Added HOSTING.md documenting scope and publishing steps. The footer now links to Business lab rather than a metrics service absent from the public frontend.
- The first cloud build exposed optional Polkadot dependencies absent from the npm 11 lockfile. Regenerated it using npm 12's resolver; Vercel's clean `npm ci` and production build then passed. No app dependency versions were changed by this correction.
- Vercel's GitHub connection was rejected for missing repository access. CLI publishing succeeded, but automatic Git-triggered deployments still need the Vercel GitHub integration granted access to this repository.
- Web tests: 16 passed, including explicit link/saved/default mode precedence. Project-wide typecheck and local production build passed. Public `/`, `/guide`, `/operator`, `/portfolio`, `/create` and `/business` returned HTTP 200.
- Completed the full simulation in the public Vercel site: operator created Solar neighbourhood hub with a 50 pUSD bond; a separate funder bought 10 shares for 100; operator balance rose from 1,950 to 2,049; operator deposited 20, allocating 19.90 after fees; funder claimed it and finished at 1,919.90 with zero pending. Saved screenshot evidence outside the repository. No blockchain transactions were submitted.

Remaining: automatic Git deployment connection, funded Portaldot contract deployment and live lifecycle proof, business pilot validation and final submission materials. Publishing the frontend does not resolve these requirements.
