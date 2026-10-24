# Current hosting scope — 24 October 2026

Public app: https://portion-one.vercel.app. Core deployment: `deployments/portaldot-testnet.json`. Live evidence: [release](LIVE-CORE-RELEASE.md), [completed protocol test](LIVE-TEST-RESULTS.md).

## What Vercel runs

- Vite/React frontend from `apps/web/dist`.
- Node serverless entry `api/index.js`, loading the bundled Hono Core API. `scripts/build-api.mjs` builds `serverless/bundle.cjs` before the frontend build.
- Verified document copies, anchors, catalog and app-submitted finalized receipts in Vercel Blob. This is durable public storage, not an archive of every outside transaction.
- A separately funded, limited test-pUSD issuer. The hosted API has its issuer key, not the deployment mnemonic. Native tPOT grants remain disabled.

`vercel.json` runs the pinned `npx --yes npm@11.21.1 ci`, then the API bundle and web build; API rewrites precede the SPA fallback. Missing services or non-JSON responses must remain unavailable rather than producing substitute records.

## Direct chain reads and trust checks

The frontend reads Portaldot testnet RPC data and uses the connected extension for native signing. It verifies the network identity, configured Core account/runtime bytecode and payment asset before enabling contract actions. Documents are hash-checked. A connected RPC does not by itself establish complete service readiness, independent asset verification or legal ownership.

## What is not hosted in this release

Legacy persistent SQLite indexing, a complete outside-transaction archive, bridge relayers, automated renewal/slashing/compounding keepers and complete network-analysis services are not deployed as ongoing services here. Their source does not make them live features. Native tools may have their own direct RPC functionality; verify each before demonstrating it.

## Publishing and operating

`vercel deploy --prod --yes --scope pleasants-projects` publishes the local project. GitHub-to-Vercel integration was not connected at the last recorded release: pushing Git alone does not prove deployment. After publication, verify API health, deployment identity, catalog, document access and the relevant UI.

Use `npm run typecheck`, relevant tests and `npm run build -w @portion/web`; build the API with `node scripts/build-api.mjs`. Fresh-install reproducibility and operational backup/restore are separate tracked tasks. Keep provider limits, issuer quotas/reserves, secret rotation and service health under review; a successful release is not an operations guarantee.

Local Core mode uses the same stateless API implementation and requires its own configured Blob/issuer service settings for those features. Legacy `FAUCET`, `KEEPERS` and `RELAYER` flags do not mean those services are running in hosted Core mode. Never place server secrets in `VITE_*` variables.
