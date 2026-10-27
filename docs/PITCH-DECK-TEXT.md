# Pitch deck text — draft for the founder to build, 27 October 2026

Source: [INVESTMENT-ASSESSMENT.md](INVESTMENT-ASSESSMENT.md), [FINANCIAL-MODEL.md](FINANCIAL-MODEL.md), [MARKET-AND-COMPETITORS.md](MARKET-AND-COMPETITORS.md), [LIVE-TEST-RESULTS.md](LIVE-TEST-RESULTS.md) and the live [evidence page](https://portion-one.vercel.app/evidence).

The organisers ask for a deck (PDF or public link) covering **the problem, why Portaldot is essential, proof the product works, and reasons for continued support**. This text is a draft, not a built deck.

**Labels used on every claim.** **[Verified]** checked in source, on chain or on an official page. **[Assumption]** a hypothesis nobody has confirmed. **[Founder]** only the founder can supply or confirm. **[Secondary]** from press or a review site, not the company's own page.

**Design rules.** Put the "Illustration · not a live record" label on any conceptual graphic. Never show a return, yield or balance. Use the homepage screenshots and the `/evidence` page rather than mock-ups. Keep the "Not protected" slide in the deck; it is the deck's strongest credibility signal.

---

## Slide 1 — Title

**Portion**
Share what an asset earns, with a record everyone can check.

Portaldot Hacker House 2026 · Ecosystem DApps
Live testnet app: portion-one.vercel.app · Code: github.com/Nailer/portion
Team: **[Founder]** names and roles.

*Speaker note:* Say at once that everything is on the test network with test tokens.

## Slide 2 — The problem

**Sharing income from equipment is done on trust and spreadsheets.**

- An operator of productive equipment (solar installations, vehicles, machinery) who shares income with funders has to report deposits and split them fairly, on a schedule. **[Assumption]**
- Today this is usually spreadsheets, bank transfers and emailed statements. **[Assumption — not researched with any operator]**
- Funders cannot check the numbers without taking the operator's word.

**Open question for the room:** how painful is this *enough* to pay for? **[Assumption: needs customer evidence]**

*Speaker note:* Do not cite statistics. None were collected. If you have spoken to the solar operator by the time you present, say what they actually said, in their words **[Founder]**.

## Slide 3 — What Portion does

**Record the terms. Record each deposit. Split it by shares. Let each holder claim.**

1. An operator publishes an asset with hashed terms, a share count, a deposit schedule and a bond. **[Verified]**
2. The operator chooses to deposit revenue; the contract takes a 0.5% fee and splits the rest by shares staked at that moment. **[Verified]**
3. Each holder claims their own allocation. Nothing is paid out until the holder acts. **[Verified]**
4. Receipts and activity are public and exportable. **[Verified]**

*Visual:* the homepage hero illustration, labelled as an illustration.

## Slide 4 — Why Portaldot

**Native assets and NFTs usable from Solidity, with the terms stored by the chain itself.**

- One atomic batch creates a deed NFT, fractionalises it into shares, sets approvals and calls the Solidity contract. **[Verified]**
- Shares and the payment asset are native assets that Solidity reads as ordinary ERC-20 tokens through the runtime's precompiles, so no separate token contracts are needed. **[Verified]**
- The hash of the terms is stored on the deed; the documents live in the chain's TransactionStorage. **[Verified]**

**What this is not:** a market argument. It is a technical fit. **[Reasoned]**

## Slide 5 — Proof that it works

**A finalized lifecycle on the Portaldot V3 testnet.**

| Item | Value |
| --- | --- |
| Core contract | `0x17501f4510ba4298b618209e105cd47036509706`, block 160,455 **[Verified]** |
| Test asset | 585886, 100 shares **[Verified]** |
| Recorded run | create → buy 100 shares → deposit 1 test pUSD (fee 0.005) → claim 0.995 → unstake **[Verified]** |
| Receipts | four finalized transactions, listed with hashes on the evidence page **[Verified]** |
| Engineering | 71 commits since 16 Oct; 232 tests passing (91 contract, 42 SDK, 59 web, 40 server) and CI green **[Verified]** |

**Be upfront on this slide:** one development account played both operator and buyer, signed by a script. It proves the contract works as written. It is not evidence of separate users, real equipment or demand. **[Verified]**

*Demo:* open `/evidence`, then `/listing/585886`.

## Slide 6 — What is not protected

**Say this before an investor asks.**

| The software enforces | It depends on people and records | Not provided yet |
| --- | --- | --- |
| Shares and a bond (at least 5% of offered value) are held by the contract | That the equipment exists and the operator may use it | Escrow of purchase money or milestone release |
| Deposits split by stake, fee shown | That the operator deposits what was truly earned | Independent verification of assets or revenue |
| Only the holder can claim | That purchase money is spent as described | Principal protection, a live secondary market |
| New purchases stop in default | Someone submitting a slash | Automatic payouts, a legal opinion |

All **[Verified]** against `PortionCore.sol`. Purchase money currently goes straight to the operator, less a 1% fee.

**What we built toward it:** a controlled-release escrow candidate with 23 tests, **local only, not deployed**. **[Verified]**

## Slide 7 — Who else does this

**Working models control the asset, the collections or a legal wrapper. Portion currently controls none of them.**

| Alternative | What it does | Source |
| --- | --- | --- |
| Sun Exchange | Runs installation and leasing; owners are paid monthly. Reported fees: a cell mark-up plus 10–20% of lease payments (may be outdated) | **[Secondary]** |
| Energea | Regulation A offerings; $100 minimum in past circulars; monthly distributions | SEC circulars **[Verified]**; fees unread |
| Sponsor-side administration (e.g. Juniper Square) | Sells reporting and fund administration to the sponsor; no published price | Company homepage **[Verified]** |
| Spreadsheets and bank transfers | Free, familiar, no shared record | **[Assumption]** |

**Our narrower bet:** a verifiable ledger and payout administration for an operator who already has funders. Whether it beats a spreadsheet is untested. **[Assumption]** We have not found a competitor offering exactly this; that is not proof none exists.

## Slide 8 — Business and economics

**The current fees do not pay for the work. A subscription might. Nobody has agreed to pay.**

- Contract fees: 1% on primary sales, 0.5% on deposits. **[Verified]**
- Model inputs, all **[Assumption]**: 10 hours of onboarding review at $40, and $100 a month to serve each operator.
- Result: an operator must deposit about **$240,000 a year** just to cover its own service cost at 0.5%. A $50,000 raise with $10,000 of annual deposits earns about $550 in year one against about $1,600 of cost.
- Hypothesis: a recurring fee from the operator. At a price of $300 a month the model needs about 105 operators to cover a $250,000-a-year team; at $1,000 a month, about 24. **[Assumption: prices untested]**
- Bonds, escrowed contributions and holders' allocations are never company revenue.

*Reproduce:* `node scripts/financial-model.mjs`.

## Slide 9 — Why keep supporting this

**Conditional, milestone-gated support, in this order:**

1. A witnessed browser-wallet session by a separate user, with receipts (needs a funded second wallet).
2. Operator discovery with the solar operator, recorded without embellishment **[Founder]**.
3. A one-page pilot scope with a price.
4. Named reviewers and a legal view *before* any controlled-release deployment.
5. Only then, a budgeted plan to migrate the controlled-funding design.

**What would raise confidence:** a written pilot commitment at a stated price; an operator depositing on schedule in test tokens; a named independent reviewer; a legal opinion on a first offering.
**What would end it:** no pain or no willingness to pay; funders don't value the record; legal review blocks the first jurisdiction.

**Ecosystem value, honestly:** an open-source worked example of native assets used from Solidity today. Recurring deposit and claim activity only follows if an operator uses it.

## Slide 10 — Ask and close

**[Founder]** State the specific support you are asking for (for example technical review, an additional test-token allocation for a separate-user test, or an introduction). Do not ask for an amount this deck cannot justify.

One line to close: *"Everything you saw is real, on a test network, and we have told you exactly what it does not protect."*

---

## Appendix slides

- **A1 — Recorded transactions:** the four hashes and blocks from `/evidence`.
- **A2 — Money flow example:** the table in FINANCIAL-MODEL.md §D (sale fee, operator proceeds, deposit fee, holder allocation, bond).
- **A3 — Controlled-release design:** the escrow roles and rules from CONTROLLED-FUNDING-CANDIDATE.md, with its known limits (collusion, 10% challenge griefing, off-contract reviewer selection).
- **A4 — Testnet cost:** the first run reduced free balance by 47.56 tPOT including storage deposits and fees; the optimised hash storage saves about 2.52 tPOT per listing **[Verified]**. Mainnet cost is unknown.

## Do not say

- Any return, yield, "earn" claim phrased as a promise, or "risk-free".
- That equipment is verified, insured or legally owned by participants.
- That there is a customer, pilot, partnership, revenue or investor commitment.
- That the work was independently audited, legally approved or commercially validated.
- That a secondary market, bridge, keeper or automatic payout exists.
- That separate users have signed in a browser. It has not been witnessed.
