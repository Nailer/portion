# Portion — execution log

## POR-S01 — completed, 24 October 2026

**Purpose:** make current project descriptions match deployed behaviour and actual evidence before submitting or showing the project to new users.

**Changed:** README, hosting, account connection, user/judge walkthrough, submission checklist, readiness, architecture text/SVG, business/current release notes and verification guidance. Earlier development/review/candidate records remain historical and clearly labelled. Removed current claims that contracts remain undeployed, funds remain unspent, every track is live, fees are configurable in Core, renewal is hosted, or a script test proves real browser use.

**Money-flow correction:** current purchase proceeds are paid to the operator after the fee. Offered shares and the limited operator bond are held by Core; purchase funds are not held for approved spending. Deposits allocate only submitted money and holders initiate claims. The new FUNDING-PROTECTION.md explains these boundaries, the small bond, default/slash mechanics, unproven physical/legal claims and proposed controlled-release/collection design. POR-R06 now explicitly tracks that future review; it is not implemented by this documentation update.

**Checked:** current-entry stale-claim search; Markdown local links; configured contract identity; documented 1%/0.5% fees and direct payment against Solidity source; SVG XML parsing and rendered visual inspection; git diff whitespace check. These are documentation checks, not a new independent contract audit, browser sign or deployment.

**Cost:** no chain transactions, no faucet usage and no contract redeployment. Source/documentation publication only. Frontend stale undeployed wording found in App/Business is separately retained in open POR-T06; this task does not falsely claim that UI fix is complete.

## POR-S02 — completed on founder confirmation, 24 October 2026

The founder reports the Submit Build/check-in action is done and requests continued development. The evidence packet and public-link checks are recorded in [CHECK-IN-PACKET.md](../CHECK-IN-PACKET.md). This is direct founder confirmation; the submitted entry/acknowledgement has not been independently inspected. The assistant did not submit the build. Keep the acknowledgement in the founder account and report organiser corrections.

## POR-S03 — completed, 24 October 2026

[TRACK-DECISION.md](../TRACK-DECISION.md) selects Ecosystem DApps as the primary fit and maps working SDK/document features to a supporting middleware contribution. No new bridge deployment, extra live track or multi-award eligibility is claimed. Open organiser questions are listed explicitly; no outside message or additional token spend occurred.

## POR-S04 — completed, 24 October 2026

A clean source-only checkout passed installation with npm 11.21.1 under Node 24.10.0, all 142 local tests (68 contract, 37 SDK, 15 web, 22 server), type checking, API bundle and production web build. Four optional SDK live tests were skipped. Runtime pin files and [SETUP.md](../SETUP.md) remove the hidden older-Node fallback. A new Vite proxy option lets a local developer read real hosted services without copying server/wallet keys; the clean browser preview loaded the actual test listing and health API. No on-chain write occurred. [SETUP-VERIFICATION.json](../SETUP-VERIFICATION.json) records exact scope, commands and limits. The baseline dependency advisory remains separately tracked in R05.

## POR-F01 — completed, 24 October 2026

Added a key-free public-account budget command and retained a finalized snapshot at block 175362. Deployment account remains 44.82920824820928 tPOT with a 40 tPOT floor; headroom is 4.82920824820928. The separate issuer holds 1.98519376656955 tPOT. [OPERATING-BUDGET.md](../OPERATING-BUDGET.md) defines current read/quote/approval/reserve/reconciliation rules; headroom is never presented as a transaction quote or permission to spend. No chain write was made.

## POR-R05 — completed, 24 October 2026

Patched the single Zod advisory chain using an exact 4.6.6 override, with a regenerated lockfile and pinned npm on Vercel. Clean installation, dependency inspection, all 74 SDK/server/web tests, type checking, API/web build and synthetic CLI-config schema checks passed; four optional live SDK tests remained skipped. The pinned npm audit reported zero known vulnerabilities. [DEPENDENCY-REVIEW.md](../DEPENDENCY-REVIEW.md) records scope, reachability limits and the initial retained-resolution problem. No contract or chain write changed.

## POR-R07 — completed, 24 October 2026

GitHub Actions now runs pinned clean-install/audit, contract/SDK/web/server tests, type checking and API/web builds on main pushes and pull requests. [The first actual Linux run](https://github.com/Nailer/portion/actions/runs/40100120771) passed all 142 tests, with four optional live SDK tests skipped. It supplies no project secrets and makes no chain writes. Release commit evidence and the manual release gate are documented in [CONTINUOUS-CHECKS.md](../CONTINUOUS-CHECKS.md); repository branch protection is not claimed.

## Sequencing

Work one task at a time; explain its purpose, changes, acceptance evidence and remaining limits. Close an issue only when its completion checks pass. Collect external facts early and continue independent preparation while waiting. Do not treat every open business/production gate as permission to spend test funds or deploy new code.

## Engineering batch — 25 October 2026

Google Cloud work is paused. [Detailed acceptance evidence](EXECUTION-2026-10-25.md) records wallet guards, recovery, receipts, exact accounting, image verification, durable faucet coordination and public-document restoration. Eighteen additional engineering tasks meet their scoped acceptance checks: **25 complete;31 remaining**. Twelve remaining tasks have partial implementation/evidence and retain their full acceptance gates. Customer evidence, independent reviews, real browser signing and final hackathon materials are not fabricated or marked complete. No chain writes or faucet expenditure occurred.

## Principal review — 27 October 2026

A fresh review carried through to implementation: [REVIEW-2026-10-27.md](REVIEW-2026-10-27.md). It narrows the first product to operator revenue-sharing administration, redesigns the public interface and adds an evidence page, publishes the investment assessment, competitor notes, hackathon evidence map and a reproducible cost model, and adds a tested **local-only** controlled-funding contract candidate. **Still 25 complete; 31 remaining (15 in progress, 16 open).** Three tasks moved from open to in progress (B05, D04, O07) and nine in-progress or completed tasks gained evidence notes; none was marked complete without meeting its acceptance text. No chain write, spend, deployment, outside message or Google Cloud work occurred.

## Market-readiness review — 29 October 2026

[MARKET-READINESS-REVIEW.md](../MARKET-READINESS-REVIEW.md) lists nine contract loopholes and nine market gaps from a developer and investor view. Three contract findings were not recorded before: faked revenue history through the operator's own staked shares (C2), the nothing-staked chain in which either a forced default sends the bond to the treasury or the operator winds down and withdraws its bond (C3), and the operator key that can never be rotated (C7). All findings are reasoned from source; none is yet demonstrated by an exploit test. Documentation only; task counts unchanged. No chain write, spend or deployment occurred.

## Core v2 candidate — 29 October 2026

[CORE-V2-CANDIDATE.md](../CORE-V2-CANDIDATE.md): `PortionCoreV2.sol` closes or narrows C1–C4 and C7. Six tests demonstrate each loophole against the deployed v1 code; twenty tests show v2 refusing them and keeping v1's fees, payouts and default protection, including a 512-run fuzz that the contract always covers claims, reserve and bond. Nine injected bugs were all caught. Full Solidity suite: 117 passing. `ControlledFunding.t.sol` now advances time from `vm.getBlockTimestamp()` (cached `block.timestamp` under via_ir); its 23 tests still pass. Local only: no chain write, spend or deployment; the SDK and app still use v1.

## Core v2 completed in code — 29 October 2026

Core v2 now closes or narrows all nine contract findings (C1–C9): purchase escrow with a funding target, deadline and full refunds; reviewer-approved tranche release with holder challenge; refunds of unreleased escrow on slash, cancel, wind-down or two failed tranches; a named reviewer who must attest before any sale; and a time-limited guardian pause that never blocks claims or refunds. The SDK, API and web app support v2 when a deployment file names `core-v2`, and leave v1 behaviour and storage paths unchanged. A read-only deploy script (`npm run deploy:check:core-v2`) estimates the cost and refuses to submit unless funded. **Not deployed:** the deployer holds 44.83 tPOT and v2 needs an estimated 800–1,110 tPOT of storage deposit. Details and test evidence: [CORE-V2-CANDIDATE.md](../CORE-V2-CANDIDATE.md). No chain write, spend or deployment occurred.

## Browser sandbox — 29 October 2026

[SANDBOX.md](../SANDBOX.md): `/sandbox` runs the unchanged Core v2 bytecode in an in-browser EVM (`@ethereumjs/evm` 10.1.3, loaded only in sandbox mode), behind the same backend interface as the live app. Five labelled roles, two seeded fictional listings, a time-skip control and a guided demo let anyone create, fund, release, claim, default, slash, refund and pause without a wallet or tPOT. Sandbox actions never enter the real receipt journal or link to the explorer, and live-only pages show a notice. The SDK now shares `coreListingView` and `refundableOf` between the live client and the sandbox. Eight new sandbox tests pass, and a browser run covered buy-out, settlement and tranche release through the real escrow panel. The three-minute video script is in the same document. No chain write, spend or deployment occurred.

## Journey and information-architecture correction — 30 October 2026

The app is now organised around visitors' goals instead of guides and modules. The hero's two actions are **Explore assets** (a new `/assets` page) and **Create an offer**. The header offers Explore assets, Create an offer, Manage offers and My portfolio, with help, evidence and network tools under More. Browsing, drafting, and the portfolio and management prompts no longer need the chain to answer first. Choosing an action without a wallet asks to connect, says why, and returns to that action's review with the form intact. Offer states are computed in one place (`offerStatus`), so "Sold out", "Sale closed", "Funding unavailable" and "No matching offers" stay distinct, and the asset panel offers only actions for the account's state. The Trade tab appears only when a market exists. The transaction sheet was rebuilt: action, plain status, amount, observed stages only, what changed, expandable receipts, then the next step. Declined, failed and unknown outcomes are separated, and a running transaction can be hidden without cancelling it. New unit tests cover these rules with isolated fixtures. These are engineering checks: no first-time-user testing has been done, so comprehension is not proven. No chain write, spend or deployment occurred.

## Light, dark and system themes — 30 October 2026

The app now has Light, Dark and System appearance, chosen from a header menu (or the menu on phones). System is the default and follows the device live; a choice is saved in the browser and applied before first paint so it never flashes. About 370 hardcoded colours were replaced with theme tokens (`apps/web/src/theme.css`). A contrast audit of every text element on the main pages in both themes finds nothing below WCAG AA for text on solid backgrounds, after fixing proof ticks that were nearly invisible in both themes. Text over gradients and images, hover states and SVG labels are not covered by that audit. No chain write, spend or deployment occurred.
