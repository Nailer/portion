# Funding, payouts and protection — current Core v1

Reviewed against `contracts/src/PortionCore.sol` on 24 October 2026. This describes the deployed testnet design, not a regulated investment product, legal opinion or promise of principal protection. Current tokens have no monetary value.

## Where purchase money goes

`buy` transfers the purchase price **directly to the operator**, less the fixed 1% sale fee sent to the treasury. It does not hold the purchase money in escrow, approve a spending budget, release funds by milestones or pay equipment vendors directly. The contract escrows offered **share tokens** and the operator's **bond**; that is different from escrowing participant purchase money.

After receiving funds, the operator can spend them outside Portion. No current contract or dashboard can prevent waste, prove equipment procurement, seize a physical asset or reverse an external payment.

## How a participant receives money

1. The operator runs the business and obtains money outside the protocol. Portion does not generate or automatically observe that income.
2. The operator submits a `deposit` transaction in the configured payment token. A 0.5% fee goes to the treasury; the net amount is allocated using the shares staked at that time.
3. A holder approves `claim` to transfer their allocated amount to their wallet. This is a pull-payment mechanism, not an automatic bank payout.
4. An operator payment meeting the listing minimum resets its payment clock. Other deposits need not reset it. The clock also starts when a listing is created; an initial clock is not proof of a first payment.

Illustrative arithmetic, not a forecast or observed business: a deposit of 10 pUSD leaves 9.95 after the fee. A participant holding 20% of the earning stake at that instant receives an allocation of 1.99 pUSD. Owning 20% of total shares is not always the same as 20% of current earning stake.

The contract cannot force revenue to be deposited, independently establish the company's profit or detect money collected through an undisclosed channel. The actual development test used 1 test pUSD, allocating and claiming 0.995, as documented in LIVE-TEST-RESULTS.md.

## What the bond and cadence do

- Creation requires a positive operator bond of at least 5% of the offered share value (with integer-unit arithmetic in the contract).
- The contract holds that bond. A normal top-up can increase it; it is not a reserve held from each participant's purchase.
- A listing becomes late after one cadence and defaulted after two without a qualifying reset. New buy/stake participation is rejected in default.
- In default, someone must submit `slash`; no automatic slashing service is deployed. The caller receives 1% of the slashed bond. The rest is allocated to current stakers, or goes to the treasury if no shares are staked.
- Closure and bond-withdrawal restrictions prevent a simple immediate withdrawal of the bond while obligations remain under the implemented rules.

A minimum bond is much smaller than the full offering. For an illustrative offered value of 100 pUSD and bond of 5, the holder allocation from that bond is 4.95 after the caller tip, assuming earning stake exists. It cannot make investors whole after a total loss. Eligibility, timing and stake allocation matter; this is not insurance or guaranteed recovery.

## What on-chain proof establishes

The native proof checks the deed's existence, fractionalization mapping, supply and pallet-controlled permissions and transfer lock. Hash checks establish that document bytes match the recorded terms. They do not establish equipment existence, accurate valuation, enforceable physical ownership, trustworthy management, audited financial statements or regulatory approval.

Unstaking returns shares, not the original purchase money. Selling requires a real permitted buyer or available market liquidity. The current completed development offer is sold out and is not an open real-equipment investment.

## Proposed direction before any real-money release — not implemented

Recommended next design review, tracked in **POR-R06**, with **POR-B06/B07** for legal/operating/payment responsibilities:

1. **Verify the operator and offering.** Establish permitted identity/asset evidence, budget, vendor details, rights, obligations and who independently reviewed each claim.
2. **Hold undisbursed funding under a defined escrow/custody arrangement.** Set a funding target, deadline, cancellation/refund rules and precise release conditions. Contract custody alone is not regulatory approval.
3. **Release against independently checked milestones.** Prefer verified vendor payments where suitable. Define who approves, who cannot approve their own milestone, what evidence is required, and how fraud or conflicts are challenged.
4. **Establish accountable collections.** Use an eligible controlled collection/payment arrangement where feasible, with reconciliation, operating-cost rules and evidence of payout obligations. A bank/API feed alone cannot guarantee all revenue is reported.
5. **Define intervention and dispute rules.** Specify who can pause undisbursed releases, what a pause can and cannot recover, timeouts, appeal, refunds, default and lawful asset remedies. Pauses must not permit arbitrary confiscation or trap funds indefinitely.
6. **Price the work and test adversarially.** Verification/custody/disputes have real costs. Test fake invoices, colluding approvers, duplicate release, missing milestones, underfunding, failed transfers, insolvency and misleading revenue evidence in isolated environments before any funded migration.

These controls can reduce specific risks but cannot eliminate loss or ensure an operator's business is profitable. They require customer evidence, defined responsible parties, qualified review and potentially new contract code/migration. **Do not present them as live controls, redeploy now, or spend the remaining faucet to simulate their existence.**

## Product decision

Keep the hackathon release testnet-only and explain the present direct-to-operator model plainly. A stronger funding product must solve controlled release and accountable collections before taking real investment. If operators primarily need records and payment administration, assess that narrower service instead of promising protected financing that the product does not enforce.

Source functions: `create`, `buy`, `deposit`, `claim`, `slash`, `windDown`, `withdrawBond`. The source tests and finalized test receipts support software behaviour; they are not commercial validation or an independent audit.
