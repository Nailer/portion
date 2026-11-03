# DoraHacks entry: proposed text — 1 November 2026

Proposed wording for [Portion's entry](https://dorahacks.io/build/50267). The founder reviews it, changes anything that isn't right, and pastes it in. Nothing here has been submitted.

## Fields

| Field | Value |
| --- | --- |
| Project name | Portion |
| One-sentence overview | Portion helps operators of earning equipment share revenue with their backers, on a record both sides can check, using Portaldot V3's native assets and EVM. |
| Track | **Ecosystem DApps** (the entry currently says Multi-Chain & Cross-Chain Infra) |
| Tags | RWA, DeFi, Solidity, EVM, Portaldot |
| Team members | Founder to confirm. The entry shows one member, Sukuna, and the deck says "solo builder" |
| GitHub | https://github.com/Nailer/portion |
| Demo link | https://portion-one.vercel.app |
| Demo video | **Replace the current link.** It points to "Paytrace Monad Metropolis Hackathon Demo Video". Use the new upload of `demo-output/portion-demo.mp4` |
| Pitch deck | Attach `docs/portion-pitch-deck.pdf`, or link https://github.com/Nailer/portion/blob/main/docs/portion-pitch-deck.pdf once it is pushed |
| Network | Portaldot V3 testnet, EVM chain ID 420420777 |
| Core contract | `0x17501f4510ba4298b618209e105cd47036509706` (block 160,455) |
| Deployment transaction | `0x6bdc10ea83152665dc6d7007d217ee4648af6fe0d6efd7b3f4f6697911034b70` |
| Lifecycle transaction | `0x353098afddba251740dcc6f7d39b6a757fc8449d647cbb5ed40666c51e9bf912` (block 165,573) |
| Explorer | Deployment: https://scanner-testnet-v3.portaldot.dev/#/extrinsics/160455-1 · Lifecycle: https://scanner-testnet-v3.portaldot.dev/#/extrinsics/165573-1 |
| Check-in form fields | The review found these mis-filled, so check each one: the summary is the overview above, the demo is the app link, the video is the new upload, and the deck is the PDF |

## Description

Paste everything between the two lines. It replaces the current description.

---

**Portion: share what an asset earns, with a record everyone can check.**

### The problem

People who run earning equipment, such as solar canopies, vehicles or machinery, often share income with the people who backed them. We expect most of this runs on spreadsheets, bank transfers and emailed statements, so backers take the numbers on trust. This is our working assumption: no operator has been interviewed yet, and that is our first milestone.

### What Portion does

1. An operator publishes hashed terms, a share count, a deposit schedule and a bond.
2. Backers read the terms and risks, buy shares and stake them.
3. The operator deposits revenue. After a 0.5% fee, it is split by staked shares.
4. Each holder claims their own part.

Portion doesn't create revenue or guarantee returns. Holders receive only money the operator actually deposits.

### Why Portaldot

With one signature, a single all-or-nothing batch mints a native NFT deed, stores the terms hash on it, fractionalizes it into shares, sets approvals and calls the Solidity contract through Revive. Native assets reach Solidity as ERC-20 tokens through precompiles, so no separate token contracts are needed. TransactionStorage holds the documents. A plain database could run the admin; Portaldot matters when backers must check the record themselves.

### What you can check

**Live on the Portaldot testnet (Core v1).** The contract is deployed, and a full create, buy, deposit, claim and unstake cycle has finalized. Addresses, blocks and hashes are at https://portion-one.vercel.app/evidence. One development account played both roles, signed by a script, so separate-user browser signing is not yet proven.

**Browser sandbox (Core v2).** Listing 585886 is sold out, and Core v2 is not deployed. So https://portion-one.vercel.app/sandbox runs the compiled Core v2 bytecode in a browser EVM, with fictional roles and pretend money. Anyone can try it without a wallet: create an offer, fund it, see the contract refuse an unapproved release, approve, release, deposit, claim, default, slash, refund and pause. Nothing in the sandbox reaches Portaldot.

**Check the chain yourself.** `npm run verify:chain` needs no wallet or keys. It compares the deployed contract with the compiled source byte for byte, then replays the contract's events and checks that the recomputed accounting equals what the chain reports.

**Engineering.** 356 automated tests pass in CI (149 contract, 56 SDK, 111 web, 40 server), with the full commit history public. Invariant tests run random call sequences against both contract versions; results, coverage and static analysis are in `docs/VERIFICATION-EVIDENCE.md`. These tests found a rounding issue, which is disclosed there. None of this is an audit.

### What changes in Core v2

Our own review found nine loopholes in the live contract. Core v2 closes or narrows them. Purchase money is held by the contract and released in tranches. A named reviewer must attest before a sale opens. Buyers are refunded if a raise misses its target, and unreleased money is refunded if the operator fails. A guardian can pause new money for at most seven days, and claims and refunds keep working. Core v2 is not deployed or audited; deploying it needs about 800–1,110 tPOT of storage deposit.

### What is not protected

Nothing verifies that equipment exists or that all income was reported. On the live contract, purchase money goes straight to the operator, and the bond is limited recovery, not insurance. This is unaudited testnet software, and test tokens have no value.

### Business and next steps

The proposed customer is the operator, paying a subscription for less allocation admin and clearer records. Our cost model shows contract fees alone would not pay for the service, and no customer, pilot or price has been agreed. Next, in order: discovery with a real operator, a pilot scope with a stated price, a separate-user browser test, Core v2 on testnet with an external review, then named reviewers and a legal view before any real money.

### Credits

Built during the Hacker House window. Third-party dependencies are listed in the README. AI coding tools, including Claude Code, were used throughout. Demo video narration generated with Kokoro-82M (Apache-2.0).

---

## Video description for the upload

> Portion helps operators of earning equipment share revenue with their backers, on a record both sides can check. This demo shows the live Portaldot testnet contract and a clearly labelled browser sandbox running Core v2 with pretend funds.
>
> App: https://portion-one.vercel.app
> Code: https://github.com/Nailer/portion
>
> Test network and test tokens only. Unaudited software. Narration generated with Kokoro-82M (Apache-2.0).

Set the video to **Public** or **Unlisted**, then open the link in a private window to confirm it plays without signing in.

## Questions for the organisers

Ask on [Discord](https://discord.gg/Vt9VpG6Ed):

1. What is Portion's live demo slot, and how long does it last?
2. Is any further step needed to count as a finalist? Portion passed the check-in.
3. Can the entry's track be changed to Ecosystem DApps, if the form doesn't allow it?
4. Do all teams present on demo day, or only a shortlist, and on which dates?
5. Must the project also post a description in `office-hour-info`? At the earlier hackathon, entries without one were invalid.
6. Do the repository name format and README template in `read-me` apply to the Hacker House?

For test tokens, mods send tPOT daily to the native `5…` address on the DoraHacks form. If nothing arrives, message Stella on DoraHacks or open a ticket in `open-ticket` and tag @Steve.
