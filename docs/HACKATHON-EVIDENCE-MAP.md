# Hackathon requirements and evidence map — read 27 October 2026

**Source:** the official [Portaldot Hacker House 2026 page on DoraHacks](https://dorahacks.io/hackathon/2362/detail), read in a browser on 27 October 2026 at about 21:30 UTC. A plain HTTP fetch of the page is refused (405), so the text below was read through a real browser session. The page embeds two organiser announcements (testnet endpoints and test-token distribution). The official Discord was **not** accessible to this review, so any rule or schedule change announced only there is unverified. Secondary summaries were not used for any fact below.

## Dates (UTC)

| Milestone | Official date | Status for Portion |
| --- | --- | --- |
| Check-in submission | 24 Oct, 12:00 | Founder reports it was submitted. The DoraHacks entry was not inspected here. |
| Feedback results announced | 26 Oct, 16:00 | Not seen by this review. Check the DoraHacks entry and Discord. |
| Office-hour application deadline | **27 Oct, 12:00** | **Already passed** at the time of this review (system clock 21:26 UTC). Unknown whether the founder applied. If not, ask organisers whether a late request is possible; do not assume it is. |
| Office hours | 28–29 Oct | Only if an application was accepted. |
| **Final submission / code freeze** | **6 Nov, 04:00** (05:00 Africa/Lagos) | Open. See checklist below. |
| Live demo day | 8–9 Nov | Confirm slot with organisers. |
| Community Choice voting | 9 Nov 16:00 – 10 Nov 16:00 | Separate award, stackable, decided by Discord vote. |
| Winners / rewards | 11 Nov / 14 Nov | — |

Tracks: Modular Cloud & Middleware; Multi-Chain & Cross-Chain Infra; Node Operations & Tooling; **Ecosystem DApps** (DeFi, RWA tokenization, consumer apps). Awards: Grand Prize 1,000 USDT; track first place 800 USDT each; Ecosystem DApps second 500 and third 300; Community Choice 200. Pool 5,200 USDT, half in POT. The page does not state that a project may enter more than one track, so none is assumed. "Modular Cloud & Middleware" is a track name, not a requirement to use any cloud provider.

## Formal requirements (what the organiser requires)

| Requirement (official wording, condensed) | Current state | Evidence | Gap / action |
| --- | --- | --- | --- |
| Leverage Portaldot V3 core features and deploy on the testnet | Met | Core at `0x17501f45…`, block 160,455; native assets, NFTs, fractionalization and TransactionStorage composed with Solidity | None for the rule itself |
| Code primarily produced 14 Oct – 6 Nov | Consistent with history | First commit 16 Oct; 66 commits from 16–25 Oct before this review | Keep committing steadily |
| ≥3 valid commits in the period | Met | `git log` | — |
| Core final versions **not** committed all at once in the last 24 h before the deadline | At risk only if work is left to the end | This review commits in staged, reviewable pieces | Do not batch the remaining work into 5–6 Nov |
| Repository public through the event | Met | GitHub API reports `private: false` | Keep public |
| Complete README, architecture diagram, deployment instructions | Met | README, `docs/architecture.md/.svg`, `docs/SETUP.md` | README should lead with the narrowed direction |
| Runnable code and demo link | Met | https://portion-one.vercel.app | Verify again after each release |
| Third-party code disclosed and licensed | Mostly met | README credits section | **No `LICENSE` file existed** although the README says MIT. A standard MIT file is added in this review; the founder should confirm the copyright holder name. |
| **Demo video ≤ 3 minutes** showing a real product, core function and Portaldot use, publicly accessible | **Not done** | — | Cannot be produced by this review. A shot list is in `docs/WALKTHROUGH.md`. Founder records it. |
| **Pitch deck** (PDF or link): problem, why Portaldot is essential, proof of function, reasons for continued support | **Not done** | — | Outline in `docs/INVESTMENT-ASSESSMENT.md` §Pitch spine. Founder builds the deck. |
| Project name, team members, one-sentence overview, contract address and tx hash | Partly | Contract and hash exist | Founder supplies team members and confirms the sentence |
| Code freeze after the deadline; serious bug fixes reported with a modification record | Rule noted | — | After 6 Nov 04:00 UTC make no substantial changes |

## Judging criteria → evidence

Weights are the official ones. The "gap" and "smallest improvement" columns are this review's own assessment, not the judges'.

| Criterion | What Portion demonstrates | Evidence | The gap that most weakens it | Smallest credible improvement |
| --- | --- | --- | --- | --- |
| **Technical feasibility (30%)** — approach, architecture, completeness, real delivery, sustained GitHub activity, verifiable testnet interactions | Deployed Core; finalized create → buy → deposit → claim → unstake; 200+ local tests; CI green at head; exact-unit accounting; recovery paths for unknown outcomes | `deployments/*.json`, `docs/LIVE-TEST-RESULTS.md`, `/evidence` page, GitHub Actions | Recorded run used **one account and a script signer**. No witnessed browser-wallet signing by a separate user. | One witnessed session: funded tester wallet signs in the browser; record receipts. Needs a funded account (see cost note in `/evidence`). |
| **Innovation (30%)** — technical, product and scenario innovation; effective use of V3 features; value beyond existing solutions | Native deed NFT + fractionalized shares exposed to Solidity as ERC-20 via precompiles, created in one atomic batch; hashed terms in TransactionStorage | `docs/architecture.md`, SDK, `docs/CORE-BOUNDARY-REVIEW.md` | The composition is novel on this chain, but "value beyond existing solutions" is unproven: purchase money is not escrowed and Sun Exchange / Energea already run end-to-end flows off-chain. | State the narrower claim honestly: a verifiable revenue-allocation ledger. Back it with the tested controlled-funding candidate (`contracts/candidates/`), clearly labelled not deployed. |
| **Ecosystem contribution (20%)** — infrastructure, developer tools, application ecosystem, user growth, sustained building, open source | Open-source SDK and receipt/recovery tooling; a worked example of native-assets-from-Solidity; MIT licence | `packages/sdk`, `docs/DOCUMENT-RECOVERY.md`, `docs/RECEIPT-COVERAGE.md` | No outside user, operator or integration. Activity so far is one development account. | A written pilot scope with one real operator (discovery, then test tokens). Publish the SDK usage notes as a short developer guide. |
| **Business potential (20%)** — real need, clear users, feasible model, team capacity | A narrowed customer (operator paying for revenue-sharing administration) and a model showing current fees do not cover service cost | `docs/INVESTMENT-ASSESSMENT.md`, `docs/FINANCIAL-MODEL.md`, `docs/MARKET-AND-COMPETITORS.md` | **No customer interview, willingness to pay, legal review or revenue.** Pricing is hypothesis. | Hold the solar-operator conversation and record what is learned, without inventing results. |

## Supporting middleware contribution

Portion's SDK, verified document copies and receipt coverage are real, working components. They are not a standalone product and no bridge relayer, keeper or archive service is deployed. This review adds **no** infrastructure and deploys **no** contract to claim another track. Whether Portion may be scored in more than one track is an organiser question the official page does not answer.
