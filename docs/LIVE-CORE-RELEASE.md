# Live Core release — 23 October 2026

Portion Core is deployed on Portaldot V3 testnet at `0x17501f4510ba4298b618209e105cd47036509706`, block 160455. Deployment receipt: `0x6bdc10ea83152665dc6d7007d217ee4648af6fe0d6efd7b3f4f6697911034b70`. See `deployments/portaldot-testnet.json` for identifiers and runtime hash.

## Using the app

1. Connect your existing native wallet (Portaldot first). The app never creates a visitor wallet or requests recovery words.
2. Obtain native tPOT from the official faucet for your own transaction fees and storage deposits. Under Tools → Faucet, explicitly request 500 test pUSD. These credits have no monetary value. Limits: one request per account per UTC day, with a service daily cap.
3. An operator selects Raise funds, enters genuine equipment information and funding terms, and attaches an image. Review and approve the document uploads and listing transaction in the wallet. Retain finalized receipts. No invented equipment is seeded. A later explicitly authorized TEST ONLY development listing exists and is sold out; see the live test evidence.
4. A participant opens an actual listing, checks its terms, backing proof, bond and payment history, then reviews a share purchase. Buying transfers test pUSD and stakes the purchased shares. Fees and storage deposits are separate from the purchase price.
5. The operator uses Workspace to deposit revenue. Participants claim their allocated deposited revenue from their positions. Income only exists when an operator actually deposits it.

Native NFT deeds, fractional shares and approvals are composed with the deployed contract in a flat native batch. A previously unmapped account is mapped as part of its action plan. Document uploads have separate receipts; an upload succeeding does not mean the later listing succeeded.

## Hosting and safety

The Vercel API verifies finalized native receipts before publishing catalog entries, activity or content-addressed document copies to Vercel Blob. No fabricated fallback data is returned. The public activity feed covers receipts submitted through this app, not a complete archive of transactions from other clients. Publication can be retried without repeating the chain transaction.

Only the separate, funded test-credit issuer key is configured in the hosted API. It has no deployment authority or native faucet endpoint. Its original gas budget is 2 tPOT; it refuses issuance below a 0.25 tPOT reserve or above a 0.05 tPOT fee. The deployment wallet is not hosted.

Deployment used a measured 401.5305 tPOT constructor storage deposit, with a hard 425 tPOT storage cap and 70 tPOT reserve policy. Approximately 92.38 tPOT remained in the deployment account after allocating the separate 2 tPOT service budget. Current balances must always be queried; this is a dated snapshot, not a live counter. No second contract deployment is required.

## Verification and limits

68 contract tests, 36 SDK tests, 15 web tests and 21 server tests passed; four optional SDK live tests were skipped. Type checking passed. A signed, read-only native dry-run passed the full create → buy → deposit → claim journey without changing the native nonce or consuming funds. Evidence: `deployments/core-batch-check.json`. This rehearsal did not create a public equipment listing and is not evidence of a browser wallet approval.

The app checks deployed runtime bytecode before enabling contract actions. Full browser signing still requires the user's compatible installed extension and native account funding. The deployed Core does not expose historical strike/deposit counts; these remain unavailable rather than invented zeroes. Native transaction-storage retention is finite; hosted hash-verified document copies provide continued access without promising an always-running renewal keeper.

Bridge relayers, automatic keepers and complete historical indexing remain outside this hosted release. The contract records token rights and operator deposits; a listing alone does not establish enforceable ownership of physical equipment. Marketing should describe the working testnet flow, without promising investment returns or production readiness.

Hosted service verification: health and empty catalog returned verified JSON; a real 500 test-pUSD credit request finalized at block 160705, transaction `0x5b7eea41dc87502592b94036b4f44070d1aa0575303ad367d4c02fd718f2c512`. The native faucet remained disabled. Desktop and mobile Tools navigation and the live listing form were checked in the production browser.

## Authorized live test completed

The disclosed Portion Development test listing and the complete native purchase/deposit/claim/unstake flow have now finalized. See [LIVE-TEST-RESULTS.md](LIVE-TEST-RESULTS.md) for receipts, final assertions, remaining balance and the transfer-lock checker correction. This supersedes the earlier statement that no public test listing exists.

## Current funding limitation

Purchase proceeds go immediately to the operator less the 1% fee. Share/bond escrow is not purchase-money escrow. No milestone releases, vendor payment controls, independent income collection, guaranteed profit or principal recovery are implemented. See [FUNDING-PROTECTION.md](FUNDING-PROTECTION.md).
