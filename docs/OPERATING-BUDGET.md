# POR-F01 — native-token budget and spending rule

The latest recorded finalized read is `deployments/operating-budget.json`. Run `npm run budget:status` to refresh it without signing, or `npm run budget:status -- --save` to retain a new dated snapshot. The script loads only public deployment configuration and runtime state, not dotenv, a wallet key or transaction submission code.

At block 175362 on 24 October 2026: deployment account free/spendable **44.82920824820928 tPOT**, frozen zero; separate credit issuer free **1.98519376656955 tPOT**. These are observations, not permanent live counters. The approved operational floor is **40 tPOT**, leaving **4.82920824820928 tPOT** above it at that observation. The issuer balance is not extra deployer spending money.

## Before any new live write

1. Identify the action and who owns/signs its account. The developer wallet is not a substitute for the user's wallet.
2. Refresh finalized public balances and any pending/unknown outcomes. Inspect existing asset/checkpoint/receipt records before creating anything again.
3. Separate payment-token amounts from native execution fees, storage deposits/holds, native setup costs, and any separately budgeted failure/operation allowance. Refunding locked deposits is conditional on legitimately freeing the relevant state, not available float today.
4. Dry-run where possible and set explicit storage/weight bounds. State the proposed worst-case total, not only a gas estimate. A cap is an allowance, not necessarily the amount charged.
5. Check that the worst-case total leaves the defined reserve and is within the current action-specific authority. `npm run budget:status -- --budget-tpot 5` checks a proposed amount against current headroom; it is not a fee quote, approval or transaction execution.
6. Stop on an unknown outcome, exceeded bound, missing evidence or insufficient funds. Never automatically raise a limit, resubmit a timed-out action or top up from another wallet.
7. Retain the finalized receipt and reconcile actual balances/fees/deposits after execution. Refresh the snapshot before any later action.

No new contract deployment, repeat test listing, operational funding transfer or native faucet grant is scheduled by this policy. Existing creation required far more than the current headroom; do not repeat it as a health check. Real extension/separate-account tests need their own funded account plan. Where more allocation is necessary, use the official organiser route with actual costs and explicit authorization; this document sends no request.

The credit service remains isolated: explicit test-pUSD requests only, limited gas budget, daily quotas and its own low-reserve/fee stops. Concurrency/nonce enforcement is a separate review in POR-R04. Automated keepers/renewers/relayers are not running and cannot inherit the deployer key.

Default development uses isolated local tests, clean builds and public receipt reads. The completed prototype does not require another deployment, and testing should never imply real-money safety merely because test tokens are available.
