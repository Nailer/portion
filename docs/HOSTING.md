> Current status, 23 October 2026: Core is deployed. The live release and current supported flow are documented in [LIVE-CORE-RELEASE.md](LIVE-CORE-RELEASE.md); this supersedes earlier undeployed-status notes below.

# Hosting scope

Vercel builds `@portion/web` with `npm run build -w @portion/web` and serves `apps/web/dist`. SPA rewrites support direct page links. There is no simulation mode, automatic account creation or balance allocation.

The frontend connects directly to the configured Portaldot testnet RPC for wallet balances, finalized network readings and native staking data. A configured deployment is checked against the network, contract rules and payment asset before financial pages are enabled. No deployed Portion configuration exists at present.

Vercel does not host the persistent Hono/SQLite API, indexer, document gateway, keeper, faucet or bridge relayer. Missing service data is unavailable, not a zero-valued record. Deploy those services separately and configure the frontend API URL before enabling their workflows. No wallet secrets belong in public frontend variables.

Check with `npm test`, `npm run typecheck`, and `npm run build -w @portion/web`. Publish with `vercel deploy --prod --yes --scope pleasants-projects`. GitHub integration is not connected, so a Git push alone does not publish the site. See [WALKTHROUGH.md](WALKTHROUGH.md) for available actions and remaining deployment work.
