# Revenue and cost model — assumptions labelled, 27 October 2026

Reproduce every table with `node scripts/financial-model.mjs`. The script asserts that fee and allocation always sum to the amount deposited. **Every input except the two fee rates is an assumption.** Nothing here is a forecast, a quote, a customer commitment or evidence of demand. Amounts are whole USD to keep arithmetic readable; the deployed contract uses test pUSD with no value.

## Inputs

| Input | Value | Basis |
| --- | --- | --- |
| Primary-sale fee | 1% | **Read from deployed Core v1** |
| Revenue-deposit fee | 0.5% | **Read from deployed Core v1** |
| Onboarding review per operator | 10 hours × $40 = $400 | Assumption. Checking identity, asset evidence and terms |
| Support per active operator | 2 hours/month × $40 | Assumption |
| Hosting, storage, monitoring per operator | $20/month | Assumption |
| Cost to serve (steady state) | $100/month, $1,200/year | Derived |
| Small team cost | $250,000/year | Assumption: two people plus tooling |

Not included: legal, insurance, KYC/AML vendors, payment-provider fees, dispute handling, customer acquisition, custody, audits, native-token costs on mainnet, tax. Each is a real cost; some may exceed the revenue below.

## A. Current per-transaction fees

| Raise | Annual deposits | Year-1 fee income | Year-1 cost | Year-1 contribution | Year-2+ contribution |
| --- | --- | --- | --- | --- | --- |
| $20,000 | $4,000 | $220 | $1,600 | -$1,380 | -$1,180 |
| $50,000 | $10,000 | $550 | $1,600 | -$1,050 | -$1,150 |
| $250,000 | $50,000 | $2,750 | $1,600 | $1,150 | -$950 |
| $1,000,000 | $200,000 | $11,000 | $1,600 | $9,400 | -$200 |

At 0.5%, an operator has to deposit about **$240,000 a year** to pay for its own service cost. Even then, nothing is left for company overhead. **The current fees alone do not support a company.** They cover the marginal cost of a large, one-off raise and nothing recurring.

## B. Subscription hypothesis

| Monthly price per operator | Contribution per operator per month | Operators needed to cover a $250,000 team |
| --- | --- | --- |
| $100 | $0 | never |
| $300 | $200 | 105 |
| $1,000 | $900 | 24 |

These prices are **not validated** and were not tested with any customer. They show the shape of the problem: a small operator paying a low fee does not cover service cost; roughly two dozen operators paying four figures a month would cover a small team, and nobody has said they will.

## C. Sensitivity to onboarding effort

Year-1 contribution for a $50,000 raise and $10,000 of deposits: **-$730** at 2 hours of review, **-$1,050** at 10, **-$1,850** at 30. Onboarding hours dominate small offerings, which is why high-touch verification and per-transaction fees do not mix.

## D. Whose money is whose, in the same example

| Flow | Amount | Belongs to |
| --- | --- | --- |
| Primary sale fee | $500 | Company revenue |
| Sale proceeds paid straight to operator | $49,500 | Operator (not escrowed today) |
| Deposit fee | $50 | Company revenue |
| Deposit allocated to staked holders | $9,950 | Participants (claimable) |
| Operator bond (at least 5% of offered value) | $2,500 minimum | Held in the contract; not company revenue |

Bonds, refundable storage deposits, escrowed contributions and participant allocations must never be counted as revenue. Hackathon prizes and grants are not operating revenue either.

## What the model says about direction

1. A funding marketplace paid by a 1% fee cannot afford the verification, compliance and dispute work that competitors charge **~7–20%** for (see [MARKET-AND-COMPETITORS.md](MARKET-AND-COMPETITORS.md); those percentages are secondary-source and unverified).
2. A **subscription to the operator for administration** is the only structure here whose revenue scales with the work. Its price and the number of operators willing to pay are unknown.
3. The real unknown is willingness to pay. One written pilot commitment would be worth more than any refinement of this table.

## What would change the model

- A customer who will pay a stated monthly price for a stated scope.
- Onboarding that is mostly self-service (shifting cost from hours to software).
- A partner who performs verification and custody, and is paid directly by the customer.
- Actual mainnet native-token costs per deposit and claim (not measurable on the testnet: the recorded test reduced free balance by 47.56 tPOT including storage deposits and fees, the split between refundable deposits and spent fees was not separately measured, and testnet tokens have no market price).
