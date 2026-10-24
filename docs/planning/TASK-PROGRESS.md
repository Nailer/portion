# Portion — execution log

## POR-S01 — completed, 24 October 2026

**Purpose:** make current project descriptions match deployed behaviour and actual evidence before submitting or showing the project to new users.

**Changed:** README, hosting, account connection, user/judge walkthrough, submission checklist, readiness, architecture text/SVG, business/current release notes and verification guidance. Earlier development/review/candidate records remain historical and clearly labelled. Removed current claims that contracts remain undeployed, funds remain unspent, every track is live, fees are configurable in Core, renewal is hosted, or a script test proves real browser use.

**Money-flow correction:** current purchase proceeds are paid to the operator after the fee. Offered shares and the limited operator bond are held by Core; purchase funds are not held for approved spending. Deposits allocate only submitted money and holders initiate claims. The new FUNDING-PROTECTION.md explains these boundaries, the small bond, default/slash mechanics, unproven physical/legal claims and proposed controlled-release/collection design. POR-R06 now explicitly tracks that future review; it is not implemented by this documentation update.

**Checked:** current-entry stale-claim search; Markdown local links; configured contract identity; documented 1%/0.5% fees and direct payment against Solidity source; SVG XML parsing and rendered visual inspection; git diff whitespace check. These are documentation checks, not a new independent contract audit, browser sign or deployment.

**Cost:** no chain transactions, no faucet usage and no contract redeployment. Source/documentation publication only. Frontend stale undeployed wording found in App/Business is separately retained in open POR-T06; this task does not falsely claim that UI fix is complete.

## POR-S02 — awaiting founder fact, not completed

The founder has been asked whether registration/check-in is already submitted, registered only, or unconfirmed. The assistant cannot truthfully infer this from a public site or a repository. The updated checklist supplies available contract/demo/receipt evidence, but it is not a submission confirmation. Do not claim an extension if the deadline passes.

Next action once the fact is supplied: reconcile actual submission status, identify the specific missing check-in material and complete permitted preparation. External submission and team claims must use verified founder facts.

## Sequencing

Work one task at a time; explain its purpose, changes, acceptance evidence and remaining limits. Close an issue only when its completion checks pass. Collect external facts early and continue independent preparation while waiting. Do not treat every open business/production gate as permission to spend test funds or deploy new code.
