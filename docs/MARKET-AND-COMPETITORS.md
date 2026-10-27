# Market and competitors — research notes, 27 October 2026

**How to read this.** Each row is marked **P** (read on the company's or a regulator's own page in this review), **S** (a secondary source such as press or a review site) or **U** (could not be verified). Several official sites blocked automated reading (Sun Exchange shows only a login; Trine's site asks for a "modern browser"; Centrifuge's docs returned 403). Where that happened, the facts come from secondary results and are labelled. **None of this is evidence that Portion is better than anyone listed.** Not finding a competitor's weakness is not a weakness.

## What customers do today

| Alternative | Customer and job | How it works | Money, custody and trust | Published price | Where it is stronger than Portion | Source quality |
| --- | --- | --- | --- | --- | --- | --- |
| **Sun Exchange** (solar leasing marketplace) | Individuals buy small "solar cells"; businesses and schools lease the installed system | The platform selects projects, installs, leases and pays owners monthly over the lease term; payout in local currency or bitcoin | The platform runs installation and billing, so it controls collections and asset verification | Reported (2017–2021 articles) as a mark-up on each cell plus a **10–20% service fee on gross lease payments**; may be outdated | Controls the two things Portion cannot: that the asset exists and that the customer pays. | **S** (TechCrunch, CNN, GreenQueen, TechZim). Own site unreadable (**U**). |
| **Energea** (US solar and energy-infrastructure investing) | Retail investors fund Energea-sponsored projects | Regulation A offerings sold on its own website with no placement agent; monthly dividends; manager is Energea Global LLC | Sponsor-run assets and a securities-law wrapper | Fees not retrieved (**U**). Past circulars list **$100 minimum** | Legal structure, disclosure regime, a sponsor that operates the assets. | **P** for structure (SEC offering circulars) and homepage; fees **U**. |
| **Centrifuge** (on-chain real-world-asset financing) | Asset originators raise financing from on-chain investors | Originators tokenize assets, a legal SPV draws financing and issues tranche tokens | Legal wrapper plus pool tranching; relies on originator and servicer | Not found (**U**) | Established legal and servicing model; investor tranches. Current architecture is unclear from the sources found. | **S** (Blockworks and others; docs blocked). |
| **Trine** (Sweden-based solar lending) | Investors lend to off-grid solar companies in emerging markets | Loans to solar companies via a regulated platform | Licensed; platform vets the borrowers | Not found (**U**) | Licensing and borrower vetting. Whether it is currently open to new investors is **U**. | **S** |
| **Receivables securitisation** (e.g. Sun King and Citi, KES 2023; $156M refinancing 2025) | Operators of pay-as-you-go solar | Bank-led vehicles buy customer repayment streams and issue notes | Institutional servicing, ratings and second-party opinions | Not public | This is what a scaled solar operator actually does when it needs capital: cheaper, larger and legally robust. | **S** (IFRE, company news pages) |
| **Juniper Square** (fund administration software) | General partners of private funds | Investor portal, reporting, administration and AML/KYC sold to the sponsor | Sponsor-side software; payments not described on its page | **None published**; "get a demo" | A working example of the *pay-the-sponsor-for-admin* model Portion's narrower direction resembles, with real compliance depth. | **P** (homepage) |
| **Equity crowdfunding portals** (Wefunder, Republic, etc.) | Companies raising small amounts from many people | Regulated portals run onboarding, escrow and investor communication | Regulated intermediary holds funds until a raise closes | Review sites report roughly **7–9% issuer fees** plus processing; sources disagree | Compliance, KYC, escrow and a trusted funnel of investors. | **S** only (a commercial review site). Official fee pages not read. **Treat the percentage as unverified.** |
| **Spreadsheets, bank transfers and email statements** | Any small operator sharing income with a few funders | Manual | Trust in the operator; no shared record | Free | Zero onboarding, familiar, no new platform. | Reasoned, not researched. |

## What the comparison shows

1. **Every working model controls collections or asset verification, or sits inside a legal wrapper.** Sun Exchange and Energea operate the assets. Centrifuge, Trine and securitisations use regulated structures and servicers. Portion does neither today, so on *funding* it is the weakest-protected option listed.
2. **Their fees pay for real work** (verification, servicing, compliance, escrow). Portion's 1% and 0.5% are far lower than these and do not fund equivalent work (see `FINANCIAL-MODEL.md`).
3. **The one model that does not require owning the asset is sponsor-side software** (Juniper Square). It earns subscriptions from the party that runs the offering and leaves custody to others. That is the closest precedent for Portion's narrower direction.
4. **Where Portion could still be better** — and this is a hypothesis to test, not a finding — is a small operator who today uses a spreadsheet and wants a record funders can verify without trusting that spreadsheet: deposits are public, the split is computed by code, and anyone can reproduce the numbers.
5. **On-chain does not itself help.** A blockchain record proves a deposit happened. It cannot prove the deposit was complete, or that the equipment exists.

## What remains unverified

- Current Sun Exchange fees and terms; Energea's fee schedule; Centrifuge's current architecture and pricing; whether Trine is accepting investors now; official Wefunder and Republic fee pages.
- Whether any competitor offers a **claim-based payout ledger for operators who already have funders**. Not finding one is not evidence none exists; the search was limited by blocked sites.
- Anything about the founder-reachable solar operator: customer size, current financing, willingness to pay. No interview has taken place and none is assumed.

## Sources

- Sun Exchange: [TechCrunch 2017](https://techcrunch.com/2017/12/04/the-sun-exchange-funds-solar-installations-with-micro-investments-and-bitcoin/), [CNN 2019](https://amp.cnn.com/cnn/2019/10/02/tech/sun-exchange-solar-south-africa), [GreenQueen](https://www.greenqueen.com.hk/sun-exchange-wants-you-to-earn-solar-powered-dollars-on-their-clean-energy-marketplace/) (secondary)
- Energea: [homepage](https://www.energea.com/) and SEC offering circulars, e.g. [Portfolio 2 and 4 filings](https://www.sec.gov/Archives/edgar/data/1865547/000186554724000004/port3_1aa_part2.htm)
- Centrifuge: [Blockworks](https://blockworks.com/news/centrifuge-real-world-assets-tokenization-ethereum) (secondary); [docs](https://docs.centrifuge.io/) (blocked)
- Securitisation: [Sun King / Citi](https://sunking.com/news-blog/sun-king-and-citi-close-first-130-million-securitisation-to-broaden-access-to-finance-for-off-grid-solar-in-kenya/), [IFRE](https://ifre.com/story/3949902/sun-king-joins-effort-to-expand-solar-abs-in-africa-fvf4pckgys)
- Juniper Square: [homepage](https://www.junipersquare.com/)
- Crowdfunding fees: [Angel Investors Network review](https://angelinvestorsnetwork.com/capital-raising/wefunder-review-2026-equity-crowdfunding-platform) (secondary, inconsistent)
