# User and judge walkthrough — updated 29 October 2026

The website reads the real Portaldot V3 test network. It creates no visitor wallet and no opening balance. The only published asset, **Portion Development — TEST ONLY**, was explicitly authorised as a protocol test; it represents no equipment, ownership, investment or revenue. All tokens are test tokens with no value.

Live app: https://portion-one.vercel.app. The public test endpoint often takes 10 seconds or more to answer; pages that need the chain say so while they wait.

## Start here: what the site is organised around

Visitors should not need this document. The header offers **Explore assets**, **Create an offer**, **Manage offers** and **My portfolio**; help, evidence and network tools are under **More**. The tables below are for checking behaviour and for judges. They are engineering walkthroughs, not evidence that first-time users understand the site; no such user testing has been done.

## A. Judge: five minutes, no wallet, no cost

| # | Start at | Do | Expect |
| --- | --- | --- | --- |
| 1 | `/` | Read the headline, the illustration and the five steps | A plain explanation of the product, labelled "Illustration · not a live record", and who controls the money at each step |
| 2 | `/evidence` | Compare the contract address, block 160,455 and each transaction hash with the explorer | Values match the repository's deployment files (a test enforces this) |
| 3 | `/evidence` → "Live check now" | Wait for the connection | "Contract found on the connected testnet" and the fees read from the contract: 1% on sales, 0.5% on deposits |
| 4 | `/assets`, then `/listing/585886` | Read the status, “Where your money goes”, the checks and activity | Labelled a disclosed development test and sold out (100 of 100 shares). No purchase button and no market is offered; the side panel says what this account can do. The 40×40 image is the original recorded bytes, not enlarged or replaced |
| 5 | `/evidence` → criteria table | Read each criterion's evidence and its biggest gap | The weaknesses are stated, not hidden: one account in both roles, no separate-user browser proof, no customer evidence |
| 6 | `/business` | Read the direction and why current fees do not cover service cost | The cost-model reasoning, with assumptions labelled |

Then read, in the repository: [INVESTMENT-ASSESSMENT.md](INVESTMENT-ASSESSMENT.md), [HACKATHON-EVIDENCE-MAP.md](HACKATHON-EVIDENCE-MAP.md), [MARKET-AND-COMPETITORS.md](MARKET-AND-COMPETITORS.md), [FINANCIAL-MODEL.md](FINANCIAL-MODEL.md), [MONEY-AND-TRUST-LIFECYCLE.md](MONEY-AND-TRUST-LIFECYCLE.md) and [CONTROLLED-FUNDING-CANDIDATE.md](CONTROLLED-FUNDING-CANDIDATE.md).

## B. First-time visitor

1. Open `/`. Within a few seconds the page says who Portion is for (operators of equipment such as solar installations, and the people who take part), the outcome (revenue shared by recorded deposit), what works today, and that the app uses test tokens.
2. Choose **Explore assets** or **Create an offer**. Further down, "Where the money goes" lists who acts, where the money is and what is not guaranteed at each step.

## C. Operator — draft without a wallet

| Step | Do | Cost / signature | Expect |
| --- | --- | --- | --- |
| 1 | Open `/create` | None | A four-step form (asset, funding, payments, review) |
| 2 | Fill in a **clearly fictional or test-labelled** asset, add a photo | None | A live preview; the draft stays only in this browser |
| 3 | Press "Save draft", refresh the page, then "Restore draft" | None | Fields return. No wallet data is stored |
| 4 | Continue to Review | None | Terms are hashed locally and the on-chain steps are listed |

**Publishing** needs a Portaldot wallet with native tPOT for fees and storage deposits and test pUSD for the bond (at least 5% of the offered value). It involves up to three wallet approvals (terms, image, create batch). Do not publish an asset that does not exist.

## D. Participant

- **Fastest full experience: the sandbox.** Open `/sandbox` and press **Start the sandbox**. It runs the Core v2 contract code in the browser with five labelled roles and pretend money, so you can buy, settle, release escrow, claim, default, slash, refund and pause in a few minutes. Nothing reaches Portaldot, and every screen says so. See [SANDBOX.md](SANDBOX.md).
- **On the live testnet today:** no offer is open, so a purchase cannot be demonstrated from the existing asset. Reading `/listing/585886` and `/portfolio` (needs a connected wallet to read, signs nothing) is the honest path.
- **To test a purchase** a new test offer must be published from one funded wallet and bought from a second funded wallet in the browser. The first test run reduced the deployment account's free balance by 47.56 tPOT (including storage deposits and fees); the optimised hash storage saves about 2.52 tPOT. Spare balance above the 40 tPOT reserve was 4.83 tPOT when last measured (24 October), so this needs more tPOT from the organisers first. **It is not authorised or funded.**

## E. Wallet

Use **Portaldot Wallet** (or another native injected wallet that appears in the dialog). Ordinary MetaMask EVM signing cannot sign the native flow, and the app does not claim otherwise. The app never asks for a recovery phrase, never creates a wallet and never uses the developer wallet for a visitor. If no compatible wallet is detected, the dialog says so and browsing continues to work. Real extension approval has been founder-reported only, not witnessed.

## F. Three-minute demo video: suggested shot list

The organisers require a public demo video of at most three minutes that shows a real product, core functions and Portaldot use. **It has not been recorded.** The recommended script is now in [SANDBOX.md](SANDBOX.md#three-minute-demo-video-script): about two minutes in the sandbox for the core functions, and the live evidence page for Portaldot use, saying on camera which is which. The earlier live-only order, which cannot show a purchase, was:

1. 0:00 — Homepage: the problem, the five steps, the test-tokens notice (20 s).
2. 0:20 — `/evidence`: contract address and a transaction hash opened in the explorer (40 s).
3. 1:00 — `/listing/585886`: terms, native-backing checks, the deposit and the claim in the activity list; say plainly it was one account (50 s).
4. 1:50 — Wallet dialog and `/create` draft: no recovery phrase, draft saved and restored (30 s).
5. 2:20 — The limits slide on the homepage and the investment assessment: what is not protected, and what evidence would change the recommendation (30 s).
6. 2:50 — One-sentence close.

If a funded second wallet becomes available, replace step 4 with a real browser-signed purchase and show its receipt. Do not simulate one.
