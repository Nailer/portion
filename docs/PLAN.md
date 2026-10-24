> Historical record: implementation stages and findings below describe their original date, including conditions since resolved. For current deployment, test evidence, spending limits and trust boundaries use [WALKTHROUGH.md](WALKTHROUGH.md), [LIVE-TEST-RESULTS.md](LIVE-TEST-RESULTS.md) and [FUNDING-PROTECTION.md](FUNDING-PROTECTION.md). Open items are tracked in [the current backlog](planning/MASTER-BACKLOG.md).

# Build plan

Window: 14 Oct – 6 Nov 2026 (check-in 24 Oct, code freeze 6 Nov 04:00 UTC).

| # | Milestone | Done when |
|---|-----------|-----------|
| 1 | Contracts (`Portion`, `Teleport`, `WrappedToken`) | `forge test` green, fuzz solvency holds |
| 2 | `@portion/sdk` | dual-VM client, address mapping, atomic batch builder, doc helpers, unit tests |
| 3 | Forked sandbox | a local fork of the live testnet runs the real V3 runtime; contracts deploy and the full flow passes |
| 4 | Server (`@portion/server`) | indexer, doc gateway, faucet, keepers (slash, renew, compound) |
| 5 | Web app | tokenize, explore, invest, portfolio, claim, trade |
| 6 | Network console + Pool Studio | validators, decentralization score, create/join pools, auto-compound |
| 7 | Teleport UI + relayer | BNB testnet ↔ Portaldot flow |
| 8 | Live deployment on Portaldot testnet | addresses + tx hashes recorded in `deployments/` |
| 9 | Submission pack | README, architecture diagram, testing guide, 3-minute video script, pitch deck outline |

Commit discipline: small, descriptive commits throughout; nothing core lands in the final 24 hours.
