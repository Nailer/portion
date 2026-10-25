# Public document backup and recovery

25 October 2026. Hosting stays on Vercel. Google Cloud work is paused.

Run `npm run backup:documents` to export the public catalog, terms and photos from the current hosted deployment. The command pins the committed Core address, validates the terms and BLAKE2 content hashes, and writes a new mode-0600 JSON file under ignored `backups/`. It needs no wallet, Blob token or cloud credentials. Keep an additional access-controlled copy outside the development machine under the project's existing storage arrangements; that copy is an operational responsibility, not an implemented replication service.

Run `npm run backup:documents -- --verify backups/FILE.json` in a fresh process to reconstruct and verify the document map. Never edit immutable document bytes to improve an old image. Missing or mismatched bytes fail rather than receiving replacement content.

Actual local check: export `public-documents-2026-10-25T08-21-28.858Z.json` contained one listing and two documents. A separate process verified and restored those bytes. Server regression tests also start a fresh API with a restored map and serve verified documents while native history is unavailable. This proves local recovery, not a live Blob disaster-recovery exercise.

Before restoring production, independently compare each listing/document hash with the configured chain at a finalized block. Internal hash consistency does not authenticate a manipulated catalog or prove equipment ownership. Restore only original verified bytes through the existing authenticated operator storage procedure; republish original receipts through the verified receipt API, never fabricate anchors. Re-read the recovered public URL and verify its hash before switching traffic. Retain the previous deployment for rollback. A live provider restoration and operator handover remain POR-R09 work.

This archive excludes secrets, full transaction history and native retention renewal. A valid local backup does not renew an expired native anchor. Native renewal still requires a separate budget and an approved transaction. No keeper or automatic renewal service is claimed.
