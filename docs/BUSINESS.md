# Portion: business direction

## Decision

> **Update, 27 October 2026.** A fresh review narrowed the first product to **operator revenue-sharing administration** and kept funding as an optional, test-only module. Reasoning, competitor comparison and the cost model are in [INVESTMENT-ASSESSMENT.md](INVESTMENT-ASSESSMENT.md), [MARKET-AND-COMPETITORS.md](MARKET-AND-COMPETITORS.md) and [FINANCIAL-MODEL.md](FINANCIAL-MODEL.md). The model shows the current 1% / 0.5% fees do not cover the cost of serving an operator; subscription pricing remains an unvalidated hypothesis. The original text below is preserved.

Build global infrastructure for companies that finance and operate productive assets. Begin discovery with the solar operator company the founder can reach. The pilot is a practical starting point, not a Nigeria-only product or a claim of an agreed partnership.

## The job customers pay for

An operator managing multiple assets needs clear funding records, agreements, funder allocations, payment reports and payouts. Portion can reduce that administration and make the history inspectable. The operator is the proposed paying customer. Funders receive allocations of money deposited by the operator; blockchain transactions do not generate business income.

Long-term advantages must come from reliable operations, trusted operator relationships, integrations with collections and accounting, and low cost to service each offering. A token, bridge or animated interface does not establish any of these advantages.

## Money flow, with an illustrative example

1. Funders pay $10,000 for an offering. At the current 1% fee, Portion earns $100 and $9,900 reaches the operator.
2. Assume the operator earns $2,000 monthly from customers and spends $1,200 operating the asset. This leaves $800 before funder payments and other obligations.
3. If the agreement calls for a $500 deposit, $497.50 goes to participating staked shares and $2.50 goes to Portion under the current 0.5% deposit fee.
4. The operator retains $300 before tax, any debt service, any proposed management fee, and omitted costs.
5. If Portion spends $250 onboarding the offering and $25 per month servicing it, its first-year contribution is $100 + $30 - $250 - $300 = **negative $420**, before company overhead and acquisition costs.

These are arithmetic assumptions, not forecasts. The example excludes the operator's separately funded bond. If equipment costs $10,000, net funding of $9,900 leaves a shortfall. Neither the current contract nor the example automatically repays the original investment or guarantees resale.

## Pricing to validate

- Deployed Core v1: fixed 1% of primary share sales and 0.5% of revenue deposits in test pUSD. Configurable-fee descriptions belong to the legacy Portion contract, not this deployment.
- Proposed, not implemented: a company management subscription and an onboarding/verification fee priced against the real effort involved. Test with the operator before building billing.
- Separate any third-party payment, legal, verification and custody costs clearly. Do not assume those costs are absorbed by the tiny payout fee.
- Do not treat offering deposits, bonds, user funds, token price increases, hackathon prizes or grants as operating revenue.

A company plan covering many assets may be more practical than high-touch support for individual small listings. The required price and minimum deal size are unknown until we see actual costs and demand.

## First pilot and decision gates

Discovery: speak with the solar company and the other reachable group. Obtain permission to inspect representative equipment costs, customer collections and current financing/administrative workflow. Do not upload private records to third parties without authorization.

Prove four things:

1. Operators have assets or expansion opportunities producing enough cash after costs to support the proposed payments, a bond and Portion's fees.
2. They will pay for a defined administrative/funding service. Seek a written, specific pilot commitment, not general enthusiasm.
3. Funders understand what they buy, where income comes from, the lack of guaranteed repayment, and the actual rights/exit/default terms.
4. Verification, support, collections and payment costs leave a positive contribution per operator relationship under realistic volumes.

Global product requirements: configurable currency/reporting and jurisdiction/eligibility rules, practical operator onboarding, funding and cash-out options, clearly assigned custody/collections responsibility, enforceable agreements, dispute handling, and permitted transfer/exit arrangements. These capabilities are roadmap work; the testnet app does not implement them all. Global infrastructure does not mean every offering is legally available worldwide.

Before accepting real investment, establish the legal and operational structure for the first operator and permitted funders. A testnet pilot can proceed without treating test funds as real capital.

## When to adjust direction

If operators value reporting and payouts but cannot or will not raise funding through Portion, offer management/reporting/payout infrastructure for their existing funding relationships. Do not assume this avoids financial regulation.

If operators will not share credible payment evidence, funders will not accept the risks/terms, or willingness to pay cannot cover servicing costs, stop adding marketplace features and reconsider the financing model. Distinguish an unusable onboarding flow from weak demand before abandoning the product.

## Current delivery

The current Business page explains the proposed model and reads verified fee rules. The earlier illustrative calculator was removed. It does not collect subscriptions, verify equipment, pull bank records, underwrite investments or promise returns.

## Purchase-fund protection gap

Current Core immediately pays net purchase proceeds to the operator. It escrows shares and the bond, not participant purchase money, and does not control subsequent spending or automatically collect business revenue. Controlled release, evidence-based vendor/milestone payments, collection oversight and dispute/refund rules are proposed design work, not deployed safeguards. See [FUNDING-PROTECTION.md](FUNDING-PROTECTION.md) and POR-R06/B06/B07 before any real-money use.
