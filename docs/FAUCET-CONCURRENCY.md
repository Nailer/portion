# Test-credit concurrency review — 25 October 2026

The hosted native tPOT faucet remains disabled. Test-pUSD issuance uses its own
limited issuer, never the deployment wallet. No mint was performed during this
review.

The previous `list → count → mint` sequence could race between serverless instances.
The new control record uses Vercel Blob's existing conditional-write support:
[conditional writes](https://vercel.com/docs/vercel-blob#conditional-writes).
Creation disallows overwrites; later writes require the exact previous ETag.
A stale cached read can cause a rejected reservation, not a second signer.

The durable record reserves one account/day and one global attempt **before**
signing. It permits at most 20 attempts per UTC day and only one pending issuer
request across instances. Legacy daily reservations are included. Attempts remain
counted after failures, avoiding unlimited fee-paying retries. Days cannot move
backwards. A pending request survives midnight and has no automatic lease expiry.

Once reserved, the service checks the fee and native reserve again. The existing
0.05 tPOT estimated-fee ceiling and 0.25 tPOT issuer reserve remain. These are
policy checks on current estimates/balances, not a promise about future network
prices. A finalized outcome is recorded before releasing the conditional lock.
An unknown submission or a crash after signing leaves issuance paused.

## Uncertain outcome procedure

Do not delete the control record, clear a pending flag just because it is old,
restart with another issuer, or retry minting. Retain the account/day reservation.
Inspect the pending recipient, request time, finalized issuer transactions and any
returned hash. Establish whether the mint finalized successfully, finalized with
failure, or remains unknown. A timestamp or absent receipt alone proves none of
these. Any administrative unlock must use the current ETag after that review;
an old worker must not be able to release a newer reservation.

Recipient ownership now requires a wallet-signed human-readable message bound to the native address, UTC day, network genesis and configured Core contract. The browser reconstructs the exact allowed message before asking for a signature. No native fee is paid for this proof; it is not an extrinsic or a request for wallet keys. It prevents requests on behalf of unrelated public addresses, but funded sybil accounts can still exhaust the daily quota.

`npm run faucet:reconcile -- --block NUMBER --hash FULL_HASH` previews an administrative reconciliation. It reads only public chain evidence and the server Blob control record, requires successful finalization with a known dispatch result, and matches the recorded issuer, call hash and explicit nonce. Add `--apply` only after reviewing that preview to conditionally release the exact reservation and retain the account/day attempt. No issuer mnemonic, mint or deployment signer is used.

For a request provably stopped before signing (`phase: reserved`, no nonce or call hash), `--abort-reserved` previews safe release; `--apply` uses the same ETag guard. A competing worker must first change that state before signing, so only one conditional transition can win. Old/ambiguous records and unknown submissions cannot use this shortcut.

This operator tool requires a securely configured server Blob token; it does not load `.env`, download credentials or run automatically. It was not applied to a live reservation during this batch. The browser receipt checker does not release the issuer lock. Production load, provider failure and operational recovery drills remain in POR-R09; this is hardened testnet infrastructure, not a production faucet.

## Evidence

Isolated tests submit 40 concurrent reservations against a conditional-write
fixture; exactly one acquires the signer. Other tests cover duplicate account
claims, 20-attempt limits, legacy records, midnight retention, stale dates and stale
finalization writes. These test coordination semantics without issuing tokens;
they do not claim a multi-instance live mint test or provider security audit.

Additional regressions verify raw and wrapped native-wallet signatures, expiry/purpose binding, a foreign recipient, an altered server message, explicit nonce/call persistence and stale administrative writes.
