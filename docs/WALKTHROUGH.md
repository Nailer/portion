# Current user and judge walkthrough

The app is live-data-only. No accounts are generated, no opening balance is granted, and no example listings or payments are supplied. Existing `?demo` links and saved simulation preferences have no effect.

## A new user today

1. Open [Portion](https://portion-one.vercel.app). Explore describes the intended equipment-funding business. The infrastructure illustration is a concept diagram, not a listed asset.
2. Open Tools → Network console. Check the finalized block, timestamp, hash and RPC source. These are direct testnet readings, refreshed every 15 seconds. Failed reads show unavailable.
3. Press Connect wallet. Use an existing compatible Substrate browser extension, approve account sharing there, and choose a shared account. Without an extension, browsing remains available; no account is invented.
4. Open the account menu. Its tPOT amount comes from the chain. pUSD shows unavailable until a real payment asset is configured. Test tokens have no monetary value.
5. Open Raise funds, Workspace or Portfolio. Until verified contracts exist, these pages explain that asset actions are unavailable. There is no purchase, revenue deposit or claim to complete today.
6. Faucet only enables requests after its service returns an actual status and amount. Bridge status is unavailable when its service cannot be reached. Pool Studio reads native staking pools and may expose real native transactions; it is separate from equipment funding.

## A judge today

Follow the same steps, then inspect [the repository](https://github.com/Nailer/portion), contract tests, signer-routing tests and deployment budget evidence. Confirm that the published frontend distinguishes working chain reads from missing contract deployment. The frontend alone does not meet the complete hackathon deployment requirement. Real extension approval and a real asset transaction have not been verified in the browser used for QA.

## Full journey after deployment — not available yet

| Step | User action | Purpose / result |
|---|---|---|
| Operator creates an asset | Supply actual asset details, photo, terms, share price, payment schedule and bond; review and approve transactions | Publish an on-chain funding offer |
| Participant reviews it | Read terms, operator information, verification and actual payment history | Decide whether participation makes sense |
| Participant purchases | Enter shares; review actual cost and fees; approve in their wallet | Pay the operator and acquire participating shares |
| Operator deposits revenue | Enter income available for distribution; review fees; approve | Allocate deposited business revenue to staked shares |
| Participant claims | Open Portfolio, review claimable income, approve claim | Receive only revenue actually allocated by the contract |
| Both check evidence | Inspect finalized transaction hashes and refreshed balances | Verify what happened independently |

Revenue depends on the operator's business and deposits. No purchase principal, resale value or return is guaranteed. A listing alone does not prove legal title to equipment.

## Next stages

1. Integrate the smaller contract candidate with the SDK, verify all required interfaces, and rerun read-only deployment budgeting. The last candidate report estimated approximately 643.10 tPOT including margin and operating buffer versus 500 tPOT available; it is not a current live quote or permission to spend.
2. Resolve that budget, deploy and verify contracts/payment asset, then host the API/indexer/document gateway. Keep operational service wallets separate from the deployment budget.
3. Complete the full journey above with real testnet transactions and capture hashes, failures and balances. No seeded commercial assets.
4. Validate an operator pilot, business costs, customer demand and legal terms before commercial use.
