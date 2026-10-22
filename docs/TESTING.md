# Verification

Current public workflow: [WALKTHROUGH.md](WALKTHROUGH.md). Runtime simulation and sample listing creation have been removed.

## Automated checks

```sh
npm test
npm run typecheck
npm run build -w @portion/web
```

Contract tests exercise accounting, authorization, solvency and bridge validation in isolated local test environments. SDK tests cover amounts, addresses and injected-wallet signer routing. Web tests cover existing-wallet connection, unavailable balances/history and deployment budget safety. Test fixtures and mocks live in test suites; they do not populate the application.

These checks do not establish real testnet contract deployment or real browser-extension signing. SDK live integration checks remain separately opt-in.

## Browser checks

1. Open Explore: no sample assets, financial totals or opening wallet balance should appear.
2. Press Connect wallet: only detected existing wallet providers are offered. No compatible extension means no account connection, not an automatically generated wallet.
3. Open Network console: verify an actual finalized block, timestamp, hash and RPC source. On failure, show unavailable rather than substitute statistics.
4. Open asset action routes without a deployment: buying, listing, claims and operator payments must be blocked with a clear explanation.
5. Open Faucet and Teleport without their services: requests must remain unavailable.
6. Repeat account dialog and guide checks on mobile and with keyboard dismissal.

## After contract/service deployment

Complete the real operator listing → participant purchase → operator revenue deposit → participant claim journey. Record finalized hashes, exact before/after balances, contract fees and any partial document-storage failures. Also test rejected approvals, unavailable services, insufficient funds and stale quotes. Never use these test transactions as evidence of commercial income or legal equipment ownership.
