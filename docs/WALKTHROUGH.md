# Current user and judge walkthrough — 24 October 2026

The website uses real testnet data. It creates no visitor wallet or opening balance. The only public development listing was explicitly authorized and clearly labels its purpose; it is not verified physical equipment or a real investment.

## Inspect Portion without spending anything

1. Open https://portion-one.vercel.app. The infrastructure illustration explains the idea; it is not asset evidence.
2. Open [Portion Development — TEST ONLY](https://portion-one.vercel.app/listing/585886). Read its test-only summary, hashed terms, native-backing checks, bond, paid amounts and actual activity.
3. The primary offer is sold out because the live test purchased all 100 test shares. This is a completed test, not an open investment or broken purchase button.
4. Open Tools → Network console for observed finalized block/hash, RPC source and separate readiness states. The observation time matters; failed reads are unavailable.
5. Read [funding and protection](FUNDING-PROTECTION.md): current purchase money goes directly to the operator less the sale fee. There is no purchase-money escrow, spending approval or guaranteed return.

## Connect and prepare your own action

1. Select Connect wallet. Portaldot Wallet is the primary presented choice. Use an actual compatible injected native account and approve sharing in the extension; no recovery phrase is requested.
2. Review the selected account and actual native tPOT/test-pUSD balances. Missing or unavailable is not zero. Ordinary MetaMask EVM signing alone cannot sign this native flow.
3. Native funds pay fees and storage; test pUSD is used for purchase/bond/deposit amounts. The hosted test-credit request is explicit and limited; native allocation is through the official organiser process. No tokens are fabricated or automatically assigned.
4. Review the actual action and signing requests. Real separate-user browser approval has not yet been fully demonstrated in our QA; the existing finalized lifecycle used a development script.

## Operator and participant journey

| Step | What to do | What it achieves and does not prove |
| --- | --- | --- |
| Prepare an asset | Enter permitted genuine details, photo, terms, shares, price, schedule and bond | Produces an unsigned offer draft; it is not independent asset verification |
| Publish | Review and approve separate document stores and the atomic deed/share/approval/Core batch | Creates on-chain terms and a test funding offer; preserve partial receipts if later steps fail |
| Inspect and purchase | Review actual terms, evidence, costs, available inventory and risks; approve in the wallet | Buys/stakes shares and pays the operator immediately less 1%; does not restrict operator spending |
| Deposit | Operator approves payment into the contract | Allocates only deposited test pUSD after the 0.5% fee; business income is not independently collected |
| Claim | Holder reviews pending allocation and approves claim | Transfers allocated deposited funds to the wallet; not automatic bank profit or repayment of principal |
| Unstake or exit | Review stake/ownership and available market options | Unstaking returns shares, not purchase money; resale requires real liquidity/buyer |

The native batch has six main calls: mint, set terms hash, fractionalize, approve shares, approve bond, Core create. Account mapping may add a call when required. Document stores are separate top-level transactions. The complete onboarding journey is not one signature.

## Judge evidence

Inspect the public repository, `deployments/portaldot-testnet.json`, `deployments/portion-test-listing.json`, [live test results](LIVE-TEST-RESULTS.md), SDK/native proof tests and source. The actual test bought 100 shares, deposited 1 test pUSD, claimed 0.995 and unstaked; one development account acted as both operator and buyer. Current history covers verified published app receipts, not every external transaction. No customer demand or independent investment is inferred.

Next gates: real extension/separate-user proof, clear cost/readiness and interruption recovery, operator/customer validation, stronger controlled-funding design and qualified review before any real-money offering. Follow the [task sequence](planning/MASTER-BACKLOG.md).
