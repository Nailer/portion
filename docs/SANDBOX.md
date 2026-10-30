# Browser sandbox and demo script — 29 October 2026

The live testnet record cannot show a purchase: listing 585886 sold all 100 shares in the recorded run, and publishing a new test offer costs about 45 tPOT, against 4.83 tPOT above the 40 tPOT reserve. Core v2 is not deployed at all. The sandbox fixes both problems without spending anything. Anyone can **create an asset, fund it, release escrow, pay and claim revenue, default, slash, refund and pause**, through the app's real pages, with nothing reaching Portaldot.

Open it at `/sandbox` (under **More → Sandbox (simulated)**) and press **Start the sandbox**.

## Conflict with the real-data requirement

The founder's earlier rule is that the product shows real, verified data. The sandbox's listings and balances are fictional, so it conflicts with that rule if it is treated as part of the product. It was built at the founder's explicit request for demonstrations, and it is kept on these terms:

- **Off by default and out of the main journey.** It lives under More → Sandbox (simulated) and in the reviewers' section of the homepage. The live product never shows sandbox data.
- **Never a fallback.** If the testnet is unavailable, pages say so and show no substitute records. Entering the sandbox is always a deliberate click.
- **Kept apart.** Its balances, receipts and history stay in that browser and never enter the real receipt journal. Its results say "Done in the sandbox only" and are never called finalized.

If the founder prefers the strict rule, the route and its navigation links can be removed without touching the live flows.

## What is real and what is simulated

| | |
| --- | --- |
| **Real** | The compiled Core v2 bytecode from `packages/sdk/src/artifacts/PortionCoreV2.json`, unchanged. At start-up the sandbox deploys it and refuses to run if the deployed runtime code differs from the artifact by one byte. Every rule is the contract's own: escrow, funding target and deadline, reviewer attestation and approval, challenge window, default, slash, refunds, reserve and guardian pause. The app's pages, review dialog, escrow panel and checks are the same code as on the live app. |
| **Simulated** | The chain: an EVM (`@ethereumjs/evm`) running inside the browser tab. Money: pretend pUSD and share tokens (`contracts/src/sandbox/SandboxToken.sol`) placed at the addresses Portaldot gives native assets. Accounts: five labelled roles with no keys. Time: moves only when the visitor skips it. The deed NFT and its fractionalization, which on Portaldot are native pallet steps, are replaced by minting the stand-in share token. |
| **Not in the sandbox** | Wallet signing, native fees and storage deposits; share markets (Portaldot's asset-conversion pallet); document storage on Portaldot; the network, evidence, receipt, pool and teleport pages, which show a notice and a way out instead. |

Every screen in sandbox mode carries a striped **Sandbox** bar that states it is simulated, not on Portaldot and pretend money. Sandbox actions are never written to the real receipt journal and never link to the Portaldot explorer.

## Roles and opening state

| Role | Starts with | Does |
| --- | --- | --- |
| Operator | 10,000 pUSD | Creates offers, requests tranches, pays in revenue |
| Reviewer | 0 | Attests to open a sale; approves each tranche |
| Buyer A | 5,000 pUSD (3,000 after the seeded purchase) | Funds, stakes, claims, challenges |
| Buyer B | 5,000 pUSD (4,000 after the seeded purchase) | A second funder, for split payouts, challenges and refunds |
| Guardian | 0 | Pauses new money for at most seven days |

Two fictional listings are seeded, each labelled "(fictional)" and "SANDBOX ONLY" in its terms:

- **100001 Riverside Solar Canopy**: already funded, first tranche released, two revenue deposits paid, so claims are waiting.
- **100002 Harbour Cold Room**: reviewed and open for funding, with a 200-share target out of 400 offered, a 14-day deadline and three tranches.

The visitor can switch role and skip a day or a week from the bar, add 1,000 pUSD to any role, and reset to the opening state from the guide page.

## How it works

- `apps/web/src/sandbox/chain.ts` runs the EVM. State is a list of operations (calls, mints, time skips). That list is saved in `localStorage` and replayed on load, so a refresh keeps the sandbox exactly where it was. Multi-step actions, such as creating a listing, run as one batch that is fully undone if any part fails.
- `apps/web/src/sandbox/backend.ts` implements the same `Backend` interface as the live app. Listing views come from the same SDK function the live client uses (`coreListingView`), so both modes show identical numbers for identical contract state. Each action is dry-run first, so a refusal (for example `Unauthorized` when the operator tries to buy its own listing) appears before the visitor confirms.
- Sandbox mode is per browser tab (`sessionStorage`), so another tab on the live site is never switched by surprise. The EVM code loads only in sandbox mode; the live app's entry bundle does not include it.

## Tests

`apps/web/test/sandbox.test.ts` (8 tests) drives the whole lifecycle through the backend interface the pages use:

- the opening state, with one earning listing and one open offer;
- buy-out, settlement, an unapproved release refused, approval, the challenge window, release, deposit, claim, default, a slash refused during the cure period, then slash and refund;
- a missed target refunding a buyer in full;
- refusals shown before confirming (operator buying, an underfunded reviewer, a non-guardian pausing);
- a guardian pause blocking a purchase but not a claim;
- creating a listing that stays closed until its reviewer attests;
- replaying the saved operation list to the same state.

The browser run on 29 October 2026 bought out listing 100002 as two buyers, settled it, requested, approved and released the first tranche through the real escrow panel, and checked the phone layout (no horizontal scroll), the live-only notices and the exit back to the testnet.

## Three-minute demo video script

The organisers ask for at most three minutes showing a real product, its core functions and its use of Portaldot. The sandbox carries the core functions; the live record carries the Portaldot proof. **Say on camera which part is which.**

| Time | Screen | Say |
| --- | --- | --- |
| 0:00–0:15 | Home | The problem: small operators of earning equipment cannot raise money from the people around them with any protection. Portion holds the money and the record. |
| 0:15–0:40 | `/evidence` (live) | The v1 contract is live on Portaldot V3 testnet: address, deployment block, a real purchase, deposit and claim. Open one transaction in the explorer. |
| 0:40–0:55 | `/sandbox` | Core v2 adds escrow, independent review and refunds. It is not yet deployed, so this sandbox runs its real bytecode in the browser with pretend money. |
| 0:55–1:30 | Listing 100002 as Buyer A, then Buyer B | Buy shares: the payment goes into escrow, not to the operator. Sell out, then settle the raise. |
| 1:30–2:05 | Same listing as Operator, Reviewer, then skip a week | The operator requests 40% with evidence, the reviewer approves, holders get a week to challenge, then it is released less the 1% fee. |
| 2:05–2:25 | Listing 100001 as Buyer A, then Buyer B | Claim deposited revenue. Then skip four weeks of silence: the listing defaults, anyone slashes the bond and buyers take back the money still in escrow. |
| 2:25–2:45 | `/sandbox` as Guardian | A pause stops new money for at most seven days; claims and refunds keep working. |
| 2:45–3:00 | Close | What is live, what is simulated, and what comes next: deployment of v2 once the storage deposit is funded, then an external audit. |

Never present a sandbox action as a Portaldot transaction.

## Limits

- The sandbox shows contract behaviour, not Portaldot integration. Native deed creation, fees, deposits and wallet signing are only demonstrated by the live v1 record.
- The EVM is Ethereum's (Shanghai rules), not pallet-revive. The contract uses no feature where the two are known to differ, but gas and storage costs are not representative.
- Sandbox state lives in one browser. It is not shared, and clearing site data resets it.
- Core v2 remains unaudited and undeployed. Running it in a sandbox is not evidence of safety with real money.
