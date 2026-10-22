# Your first visit to Portion

Portion connects two sides of a productive business: an operator who wants funding for equipment, and funders who want to receive a share of the income that operator pays in. Examples include solar installations, charging equipment, bike fleets and cold rooms. The intended market is global.

Today this is an interactive prototype. The public website starts in **Simulated mode**. There are no real investments, earnings or withdrawals. The demonstration works in your browser, uses separate operator and funder accounts, and resets when you reload. Keep the same tab open while following the steps. No wallet extension is needed: **Get started** lets you choose a demo role, and the Operator/Funder banner switches between accounts with 2,000 simulated pUSD each. The web app never asks for a recovery phrase. Live testnet tools can connect to a compatible browser wallet, which keeps the keys and approves signing.

## If you want to fund an asset

Your reason for visiting is to understand an opportunity, see the operator's terms and payment record, and follow any income allocated to your shares.

1. Choose **Funder** in the simulation banner.
2. Press **Explore**, then **View asset** on an asset card. Search and category buttons help you find assets.
3. Read its description, terms, price per share, payment schedule and operator bond. The bond is money the operator locks as limited compensation if payments stop; it does not guarantee your purchase money back.
4. On **Buy**, choose a number of shares. Press **Buy … shares**, check the amount in the review, then **Confirm**. Close the success message. Bought shares automatically join the group eligible for future deposits.
5. Open **Portfolio** to see your shares, reference values and income ready to claim. A reference value is based on the original price, not an offer to buy your shares back.
6. When income is available, press **Claim income**, review, **Confirm**, then **Close**. The allocation moves into your simulated account balance.

If you see no income, that can be correct: buying shares does not create earnings. The operator must deposit revenue. Use the operator steps below to demonstrate that payment yourself.

## If you operate a business

Your reason for visiting is to present equipment funding terms, receive funding, and manage the payments you owe to participating funders.

1. Choose **Operator** in the banner.
2. Open **Raise funds**. Press **Fill with the demo solar example**, or enter your own test information.
3. Follow **Your asset → Funding → Payments → Review**, pressing **Continue** between stages. These describe the asset, number and price of shares, payment schedule, minimum payment and separate bond.
4. Press **Review and publish**, check the review, then **Confirm** and **Open the listing**. This creates a simulated listing, not proof that physical equipment has been verified.
5. Open **Workspace** to see your listings, funding received, bonds, payment deadlines and activity.
6. Once someone has bought or staked shares, press **Pay revenue** beside the asset. Enter a payment, then **Review revenue payment → Confirm → Close**. The preview shows the platform fee and the amount allocated to funders. A payment below the minimum does not reset the deadline.

The faster demo starter in Workspace is described below. In a real service, the business earns money from its customers and pays an agreed share into Portion. Selling shares is funding, not business profit.

## A judge's complete walkthrough

Use this sequence to see the same listing work from both sides. Do not reload midway, and select the asset created in step 2 rather than a seeded example.

1. Read the homepage and **How it works**. Confirm that the banner says **Simulated mode**.
2. Choose **Operator → Workspace → Create demo solar asset**. Press **Confirm**, then **Close**. The new listing is **Solar neighbourhood hub**, offering 100 shares at 10 pUSD each and a separate 50 pUSD bond.
3. Choose **Funder → Explore**. Open **Solar neighbourhood hub**, select 10 shares, and press **Buy 10 shares → Confirm → Close**. The funder pays 100 pUSD; the operator receives 99 after the 1% sale fee. The funder's balance becomes 1,900.
4. Choose **Operator → Workspace → Pay revenue** on this asset. Leave the amount at 20 pUSD. Press **Review revenue payment → Confirm → Close**. The 0.5% fee is 0.10 pUSD, leaving 19.90 allocated to the funder, who owns all 10 currently earning shares in this example.
5. Choose **Funder → Portfolio → Claim income → Confirm → Close**. Confirm that the balance becomes 1,919.90 and the pending allocation becomes zero. This is a partial income payment after a 100 purchase, not a net profit of 19.90 or repayment of principal.
6. Visit **Tools → Business lab** to examine operator and platform economics. Change assumptions and see the result. A management subscription is a pricing hypothesis, not an active billed product.
7. Optional: after the basic walkthrough, use **Skip a week ahead** to inspect payment status changes. Default and a possible bond penalty require more than two missed periods; the button does not itself deposit revenue or create a claim. The bond is limited compensation.
8. Optional: **Use the live testnet → Tools → Network console** inspects actual network data. Portion's contracts are not deployed; live buying and revenue payments are unavailable. Some tools also need the separate API server. Return to **How it works → Start the walkthrough** to restart the simulation; previous simulation changes will be lost when its backend is recreated.

## What the main buttons mean

| Button or page | Purpose |
|---|---|
| Explore / View asset | Browse assets and read an individual listing |
| Raise funds | Create a listing and its funding/payment terms |
| Workspace | Operator dashboard for funding, bonds and revenue payments |
| Portfolio | Funder dashboard for shares and claimable income |
| Operator / Funder | Switch between separate simulated accounts |
| Buy | Buy offered shares; they begin earning future deposited revenue |
| Yours | See your stake and pending income on one listing |
| Trade | Demonstrate secondary trading when a liquidity pool exists; a resale is not guaranteed |
| Confirm | Execute the reviewed action in the selected mode |
| Business lab | Explore who receives money and whether assumptions cover costs |
| Skip a week ahead | Advance the simulation clock to inspect late-payment behaviour |
| Use the live testnet | Leave simulation and connect to Portaldot; this does not deploy our contracts |
| Testnet faucet | Request test tokens when a funded faucet is enabled; the real faucet is currently disabled to preserve the deployment allocation |

## What remains before real use

The UI and browser simulation work, and contract tests exercise the accounting and bond rules. This is not yet a service accepting real money. We still need the Portaldot deployment and recorded live lifecycle, pilot business validation, reliable evidence of business revenue, legal agreements, production wallet handling and appropriate review before accepting real funds. Equipment ownership and revenue are not independently proven just because a listing is recorded on a chain. Returns and resale are not guaranteed.

Portion's current transaction-fee model is 1% of share sales and 0.5% of revenue deposits. These are platform revenue, not proof of a profitable business. Funders' income depends on actual payments, and operators benefit only if funding terms work for their businesses.
