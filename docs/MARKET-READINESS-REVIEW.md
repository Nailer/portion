# Market-readiness review — loopholes to close, 29 October 2026

Perspective: a senior developer and a prospective investor asking what must change before Portion is fit for real operators and real money. Sources: `contracts/src/PortionCore.sol` as deployed (Core v1, read at commit `648e87a`), the web app, and the existing reviews linked below. This is an engineering and investment review, **not an audit or legal opinion**. No chain write, spend, deployment or outside contact occurred.

**Evidence level.** C1, C2, C3, C4 and C7 are demonstrated against the deployed v1 code by `contracts/test/CoreV2Loopholes.t.sol` (`CoreV1LoopholeTest`), and fixed or narrowed in a **local, undeployed** [Core v2 candidate](CORE-V2-CANDIDATE.md). C5, C6, C8 and C9 are reasoned from source and earlier reviews.

## Verdict

**Not investable today; worth watching with milestone-gated support.** The contract is small, consistent and well tested for what it claims, and the project is unusually honest about its limits. But the record it keeps can be gamed by the operator, two paths leave holders with nothing after the operator walks away or defaults, and there is no evidence that any operator wants or would pay for it. Today Portion is a test-network ledger for splitting revenue, not a protected funding product.

## 1. Contract loopholes

"Status" says whether an earlier document already recorded the behaviour. **Known** items were disclosed but not fixed; disclosure is not protection.

| # | Loophole | Code | Abuse path | Status | Severity | Fix |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | **Health can be kept green with a token deposit.** The operator sets its own minimum, and any value above zero is accepted. | [PortionCore.sol:132](../contracts/src/PortionCore.sol), [:193](../contracts/src/PortionCore.sol) | Create with a minimum of 1 unit and deposit 1 unit each period. The listing shows "on time" forever while real revenue is kept. | Known ([lifecycle step 7](MONEY-AND-TRUST-LIFECYCLE.md)) | High | Floor the minimum relative to the raise; show cumulative deposits against the operator's stated forecast; add a period report signed by a named reviewer. |
| C2 | **Revenue history can be faked.** The operator keeps the unsold shares and can stake them. Deposits split across all staked shares, so most of a fake deposit comes back to the operator. Deposits from any address also count toward the listing's revenue total. | `deposit` [:186–197](../contracts/src/PortionCore.sol) | Holding 90% of staked shares, the operator "deposits" 100 and gets about 89.5 back. A strong-looking record costs about 10.5% of the faked amount and can be used to sell more shares. | **New** | High | Record which deposits reach outside holders; show the operator's share of stake on the listing; count only outside-holder allocations as track record; attribute third-party deposits separately. |
| C3 | **When nothing is staked, holders lose either way.** A deposit is refused when nothing is staked. (a) If every holder unstakes, an operator that sold all its shares cannot deposit, falls into default and can be slashed; with nothing staked, the slashed bond goes to **Portion's treasury**. (b) Alternatively, the operator can wind the listing down while nothing is staked and withdraw its bond two periods later; holders keep shares with no further income and no bond behind them. | [:188](../contracts/src/PortionCore.sol), [:224–225](../contracts/src/PortionCore.sol), `windDown` [:246](../contracts/src/PortionCore.sol), `withdrawBond` [:255](../contracts/src/PortionCore.sol) | (a) A holder group, or one holder in a small listing, unstakes and forces a default. The company profits from that default, which is a conflict of interest. (b) The operator waits for a moment when nothing is staked and exits with its bond. | Facts known ([boundary review](CORE-BOUNDARY-REVIEW.md)); **the abuse chain is new** | Critical before real money | Let deposits accrue by shares held, not shares staked, or hold them until someone stakes; require holder notice and a waiting period before wind-down while any sold shares exist; never send a slashed bond to the treasury. |
| C4 | **Holders who unstaked get no share of the bond.** Staking is refused during default, and a slash pays only current stakers. | `stake` [:169](../contracts/src/PortionCore.sol), `slash` [:218](../contracts/src/PortionCore.sol) | A holder who unstaked before the default cannot restake and receives nothing from the bond, while those who stayed staked share all of it. | Known; disclosed in the app | Medium | Allocate the slash by shares held, or allow staking during default solely to receive the slash. |
| C5 | **No escrow and no minimum raise.** Each purchase pays the operator at once. | `buy` [:161](../contracts/src/PortionCore.sol) | Sell 3% of the target, close the sale, keep the money. Nothing can pause or reverse it. | Known ([funding protection](FUNDING-PROTECTION.md)) | Critical before real money | Target, deadline, refund, staged release with independent approval. Designed and built as a **local-only** candidate ([ControlledFunding](CONTROLLED-FUNDING-CANDIDATE.md)); not deployed. |
| C6 | **The bond is small and a default only stops new buying.** Minimum 5% of the offered value. | `create` [:132](../contracts/src/PortionCore.sol) | Holders recover at most about 5 cents per dollar raised, and only if someone submits the slash. | Known | High | Larger bond, or a bond that grows with time; staged release so unreleased money is the real protection; a keeper that submits slashes. |
| C7 | **The operator address can never change.** There is no rotation function. | whole contract | A lost or stolen operator key leaves the listing unable to deposit; it defaults and is slashed. A stolen key can also wind down or close the sale. | **New** | High | Operator rotation with a delay and holder notice; recommend or require a multisig for operators. |
| C8 | **No emergency stop and no upgrade path.** Token, treasury and fees are fixed with no setters, by design. | whole contract | A discovered bug cannot be contained; every listing must migrate. | Known design choice; market risk not previously stated | Medium | A time-limited pause held by a multisig that can stop **new** money but never block claims or unstaking; a written migration plan. |
| C9 | **Anyone can list, with any terms that pass basic checks.** | `create` [:130](../contracts/src/PortionCore.sol) | Direct contract callers skip every check the web app performs. | Known | High | Keep the contract open, but have the app show only listings whose reviewer is recorded on-chain, and label all others as unreviewed. |

## 2. Gaps outside the code

| # | Gap | Why it blocks the market | What to add |
| --- | --- | --- | --- |
| M1 | **No demand evidence.** No operator interview, letter of intent or agreed price. | The largest risk. Without it no other fix matters. | Five operator interviews recorded without embellishment; one written pilot at a stated price. |
| M2 | **The fee model does not cover its own cost.** At 0.5% an operator must deposit about $240,000 a year to cover its service cost ([cost model](FINANCIAL-MODEL.md); inputs are assumptions). | The company loses money on every typical operator. | Charge the operator a recurring administration fee; keep on-chain fees as a small extra. Test the price in the pilot. |
| M3 | **Legal status.** Transferable shares paying a revenue stream look like securities in most jurisdictions; there is no identity check, investor limit, disclosure regime or transfer restriction. | Real-money use could be unlawful. | A legal opinion for one first jurisdiction; identity checks and allow-lists; transfer controls; required disclosures. |
| M4 | **Nothing ties the record to reality.** No check that equipment exists or that deposits equal earnings. | A hash proves a document is unchanged, not true. | A named independent verifier per asset; a link to the operator's real income source (for example solar meter data or a dedicated collection account) with reconciliation. |
| M5 | **No path to or from real money.** Test pUSD only. | Operators and funders work in their own currency. | A named stablecoin and a regulated conversion partner. |
| M6 | **No exit for holders.** Shares cannot be resold; unstaking never returns the purchase price. | Funders will price in total illiquidity. | At minimum an operator buy-back clause in the terms; a resale venue later, only with real counterparties. |
| M7 | **Narrow reach.** Only the Portaldot Wallet signs; the public endpoint takes about 11 seconds to be ready (one measurement); Portaldot's mainnet and liquidity are unproven. | Most funders will not install a new wallet for one asset. | A simpler funder sign-in; a stated plan if the chain stalls. |
| M8 | **Key-person risk.** One person built and runs everything. | An investor is backing an individual, not a team. | Named team members; a second reviewer of contract changes; an external audit before mainnet. |
| M9 | **No separate users.** One script-signed account played both operator and buyer. | Proves the contract works as written, not that people can use it. | A witnessed session with two separate browser wallets, with receipts (needs a funded second wallet). |

## 3. Order of work before investment

1. **Before any outside testing:** fix C1–C4 and C7, and stop slashed bonds going to the treasury. *Done locally:* the [Core v2 candidate](CORE-V2-CANDIDATE.md) refuses each demonstrated attack, and nine injected bugs were all caught by its tests. Remaining for this step: a second engineer's review of v2, and the SDK and web changes to use it.
2. **Before a first pilot:** combine the fixes with the escrow candidate (C5); run the two-wallet session (M9); sign one operator to a priced pilot (M1, M2).
3. **Before real money:** legal opinion and transfer controls (M3), an independent verifier (M4), a conversion partner (M5), an external audit (M8), and a pause and migration plan (C8).
4. **To grow:** a tested subscription price, meter or bank-data reconciliation, and an exit route for holders (M6).

## What would change the verdict

- **Toward investment:** a signed pilot at a stated price; an operator depositing on schedule in test tokens for several periods; v2 fixes demonstrated by tests and reviewed by a second engineer; a legal view that names a workable first offering.
- **Against:** operators do not feel the pain or will not pay; funders do not value an on-chain record over a statement; legal review blocks the first jurisdiction.

## Related documents

[Money and trust lifecycle](MONEY-AND-TRUST-LIFECYCLE.md) · [Funding protection](FUNDING-PROTECTION.md) · [Core boundary review](CORE-BOUNDARY-REVIEW.md) · [Investment assessment](INVESTMENT-ASSESSMENT.md) · [Financial model](FINANCIAL-MODEL.md) · [Controlled-funding candidate](CONTROLLED-FUNDING-CANDIDATE.md)
