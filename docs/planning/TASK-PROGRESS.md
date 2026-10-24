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
