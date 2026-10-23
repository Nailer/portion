# Authorized live protocol test — 23 October 2026

Listing: [Portion Development — TEST ONLY](https://portion-one.vercel.app/listing/585886), native share asset **585886**, deed collection **9**, item **438052709**.

The user explicitly authorized this test listing using the Portion logo and project information. Its public name, summary and immutable terms say that it represents no physical equipment, legal ownership, commercial investment or real revenue. Test tokens have no monetary value. This is an exception for a disclosed protocol test, not an invented business asset.

## Finalized receipts

| Action | Block | Transaction hash |
| --- | --- | --- |
| Store terms | 165542 | `0x53f078687cf6601698b7e07f7ba8beed6248342feb32bbaad38c42173e56f943` |
| Store logo | 165547 | `0x4d23ac900909bc77045f9aa1e9e5f0d8da2043203e89153a10f289608b747327` |
| Create deed, fractional shares, sale and bond | 165551 | `0xb8ed7f04904bd53080fddf341fde1d8bc01a4dfdb88574af6cfd423bb7f82085` |
| Buy → deposit → claim → unstake, atomically | 165573 | `0x353098afddba251740dcc6f7d39b6a757fc8449d647cbb5ed40666c51e9bf912` |
| Optional explicit admin deed lock | 165586 | `0x3ab13fcb73df6c5cf9746c43ee8d1c3f10332f3addd4977b283075ace2847d8b` |

One development account acted as operator and buyer. These are real finalized testnet transactions, not evidence of outside investment or customer demand. It bought all 100 shares for 100 test pUSD, deposited 1 test pUSD, paid the 0.005 test-pUSD revenue fee, claimed 0.995 test pUSD and unstaked all shares back into the wallet. The test offer is sold out; there are no remaining shares to buy from this offer.

Final assertions checked on-chain: sold 100; for sale zero; sale closed; recorded net revenue 995000 base units; pending claims zero; stake zero; 100 shares in the wallet; deed locked; native asset proof verified. All app activity and document copies were published from verified finalized receipts.

## Budget and optimization

Total native free-balance reduction, including storage deposits and fees: **47.56004989 tPOT**. Remaining deployer free balance: **44.82920824 tPOT**. These are dated measurements, not live balances. The 52 tPOT test budget and 40 tPOT remaining reserve were respected. No contract was redeployed and the separate credit-service gas account was not used.

The document hash is now stored as 32 raw bytes on the deed, rather than a 74-byte text encoding. At the observed native storage rate of 0.06 tPOT per byte, this saves **2.52 tPOT per future listing** while preserving the exact hash. The live test used a 39 tPOT contract storage cap, below the SDK's conservative fallback. Unused gas is refunded by the runtime; a larger limit is not the same as the amount charged.

The purchase/deposit/claim/unstake sequence used one flat atomic batch and released temporary stake storage before completion. Repeated tests must inspect existing receipts rather than create another listing. Prefer read-only checks and the current asset for further work.

## Transfer-lock finding

The original proof checker only recognized the NFT's explicit ItemSettings transfer flag. A signed **read-only historical** transfer attempt at block 165573, before the optional admin lock, returned `nfts.ItemLocked` even though ItemSettings was zero. The fractionalization pallet already enforces its runtime Locker.

The checker now recognizes that lock only with a complete native deed-to-asset mapping, matching original fraction count, current supply and pallet-controlled permissions. Missing or mismatched backing still fails. An explicit `nfts.lockItemTransfer` is not required for future listings: it requires the collection Freezer and would block ordinary operators. The optional admin lock on this test deed is retained as additional protection, at a small transaction cost.

Evidence: `deployments/portion-test-listing.json` and `deployments/portion-deed-lock-check.json`. Browser wallet signing remains a separate user-driven check; the live test used the development script signer.
