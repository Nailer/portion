# Legacy SQLite indexer recipe — not the current hosted service

The Vercel release retains partial app-published receipts; it does not run this persistent indexer. See [current receipt coverage](RECEIPT-COVERAGE.md). The procedures below apply only to a separately operated legacy indexer and authorize no new service or Google Cloud work.

# Finalized index operations

The indexer now follows finalized heads. Each block's event rows and cursor commit in one SQLite transaction. Replay replaces that block's derived events instead of counting payments twice. Missing/pruned blocks stop progress and make financial-history endpoints unavailable. `/api/health` exposes cursor, finalized head, source range, completeness and errors.

An old index may have skipped blocks or recorded provisional events. It is deliberately not certified by the new version. An index also belongs to one genesis hash and contract address; mixing networks/contracts is rejected.

## Rebuilding an old or incomplete index

1. Stop the backend and its keepers. Back up the existing database and its WAL/SHM files consistently; retain locally cached document bytes because the public node may no longer retain them.
2. Confirm the correct network, contract and exact deployment block. Obtain an RPC retaining historical block bodies AND state from that block onward. A pruning RPC alone cannot prove complete history.
3. Point `DB_PATH` at a new database and configure that archive RPC. Preserve the old database until the rebuild, document recovery and history reconciliation are complete. Do not merely reset the old cursor/version markers.
4. Start the service with spending jobs disabled. Wait until `/api/health` reports the expected `fromBlock`, caught-up `lastIndexed`, and `historyComplete: true`. Compare actual payment logs against finalized receipts.
5. Restore/import cached documents through a separately verified process if needed. A new index starting at contract deployment cannot discover documents uploaded before deployment; retention and gateway availability require their own checks.
6. Enable operational jobs only after their separate accounts, budget, permissions and receipt checks are validated.

If no archive is available, keep complete financial history unavailable. Do not replace missing history with zero revenue or certify a partial ledger as complete.
