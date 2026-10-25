# Receipt coverage and reconciliation

Portion retains finalized receipts submitted through the app's public API. It
does not run a full chain archive. Outside transactions and failed publication
can leave receipts missing even when the contract balance and allocation totals
have already changed. Never interpret an empty chart as zero business income.

`GET /api/listings/:assetId/history` reads cumulative allocation from Core at one
identified finalized block, then compares it with all published receipts up to
that block. The response includes the block/hash, both totals, the missing amount
and an inconsistency flag. It includes net revenue deposits and slashed bond money
actually allocated to holders. Claims are withdrawals, not new revenue. Actual
business earnings are self-reported by the operator; neither total audits them.

Matching totals still leave `indexedHistoryComplete: false`: transfers, claims,
zero-allocation events or other outside activity can remain absent. An excess
published total is an inconsistency, never a negative missing balance or extra
income. Missing/malformed amounts and unavailable storage fail visibly.

Catalog and receipt collections follow Blob pagination, with cursor-progress and
page-budget checks. Exhausting the server page budget fails instead of returning
a silently incomplete collection. Downloads run in bounded groups. The activity
endpoint shows only the latest 200 matching events; it is not a complete export.

To import an outside receipt, submit its actual finalized block number and
transaction hash to `POST /api/receipts`. The API verifies inclusion, dispatch,
Core-emitted events and listing documents. Importing does not submit another
financial transaction. A full archive would require a separately hosted indexer,
archive-capable RPC and an audited backfill/checkpoint process. None is claimed
or newly provisioned here; Google Cloud remains paused.

Regression checks cover multiple storage pages, repeating cursors, unavailable
records, missing outside allocations, claims, slashes, newer-block exclusion and
the finalized snapshot route. These are isolated fixtures, not invented public
activity.
