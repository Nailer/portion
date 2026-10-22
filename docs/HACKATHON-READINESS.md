# Portaldot Hacker House readiness

Verified against the [official event details](https://dorahacks.io/hackathon/2362/detail) on 21 October 2026. All local times below are Africa/Lagos (UTC+1).

## Dates

- Check-in: 24 October, 13:00 Lagos (12:00 UTC).
- Office-hour application: 27 October, 13:00 Lagos.
- Final submission / code freeze: 6 November, 05:00 Lagos (04:00 UTC).
- Live demo: 8–9 November UTC. Check the organiser’s schedule for the slot time.

## What Portion is building for this event

A Portaldot-native asset-funding and revenue-management app for operators and funders, with global operator infrastructure as the business direction. The first possible pilot contact is a solar operator company; no signed partnership or traction is claimed.

Primary fit: **Ecosystem DApps**, specifically RWA tokenization and a consumer-facing application. The native module composition, dual-address SDK and document gateway also fit **Modular Cloud & Middleware**. Node tools and the bridge are supporting components and must not be presented as live-proven before their own checks pass.

The key technical demonstration is a native NFT → fractional native shares → approvals → Solidity listing in one atomic batch, with terms/photos stored in separate top-level storage transactions. The whole onboarding flow is not one transaction or signature.

## Judging alignment

| Criterion | Weight | Evidence / remaining work |
|---|---:|---|
| Technical feasibility | 30% | Automated contract/SDK/web/server checks; executable scripts; read-only live tests; live deployment and full lifecycle still required |
| Innovation | 30% | Native-module composition plus Solidity, fixed share supply, operator payment cadence and bond rules; explain the real-world trust limits |
| Ecosystem contribution | 20% | Reusable SDK, gateway/indexer, test-token faucet, native trading and tooling; prove the components actually demonstrated |
| Business potential | 20% | Operator/funder workflows, explicit costs and fees, business calculator, company-plan hypothesis and a concrete pilot-discovery path; willingness to pay remains unvalidated |

## Submission requirements and status

| Requirement | Current state |
|---|---|
| Public GitHub repository | Published at https://github.com/Nailer/portion |
| At least 3 event-window commits | Original 16–17 October history preserved; current development grouped into dated feature/fix commits on 21 October |
| Complete README, architecture and runnable instructions | Present; update alongside final live evidence |
| Demonstrable prototype / core flow | Simulation lifecycle tested with separate operator/funder accounts |
| Portaldot testnet deployment info: address and tx hash | Blocked by test-token budget; read-only preflight is not a deployment |
| Check-in demo link or video of at most 3 minutes | Public frontend with real chain reads at https://portion-one.vercel.app; full deployed lifecycle and video remain outstanding |
| Final runnable code and testnet information | Code runnable locally; finalize after deployment |
| Final demo video of at most 3 minutes | Not produced |
| Pitch deck PDF or public link | Outline exists; deck not produced |
| Build-period code and continuous development evidence | Existing Git history plus development-stage documentation; preserve ongoing checkpoints |
| No first-time core-module dump in the final 24 hours | Keep incremental work recorded before the freeze |
| Dependencies and sources disclosed | README lists major dependencies; retain attribution |

## Evidence discipline

- `deployments/preflight.json` and `.md` are read-only runtime/budget snapshots, not transaction or deployment evidence.
- `deployments/portaldot-testnet.json` records completed deployment checkpoints only; partial records are not exposed as a ready deployment by the server/app.
- `npm run e2e` is intended to produce actual lifecycle hashes after a funded deployment. No report should claim success until it has run successfully.
- The fixed 500 tPOT allocation remains unspent. The latest optimised core budget is 1,198.235 tPOT, so live deployment is still unfunded. API spending jobs default off and never inherit the deployment key for faucet/keeper use. Additional funding is not assumed.
- A separate, unintegrated `PortionCore` candidate reduces estimated storage deposit to 481.1685 tPOT. Its provisional budget with margin, working buffer and estimated deployment fee is 643.0975 tPOT. See `deployments/core-candidate.json` and `docs/CORE-CANDIDATE.md`; this does not change the app's deployment status or establish that 500 covers the full lifecycle.
- Simulation is always labelled. Generated seed listings are demonstration assets, not verified businesses.
- Shares, an NFT record and hashed documents do not independently establish legal ownership of physical equipment, prove business revenue or guarantee principal repayment.
- Community Choice can stack with other awards. Grand Prize replaces a track first-place award for the same winner. Multiple track-award stacking is not explicitly confirmed by the public details.
