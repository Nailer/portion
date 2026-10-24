# Reproducible setup — Core testnet release

Use a source checkout with **Node 24.10.0** (pinned in .nvmrc/.node-version), **npm 11.21.1**, and Foundry **1.5.1** for the recorded contract-test run. Root engines also list compatible Node ranges, but these exact versions are the recorded setup baseline. Earlier Node versions such as 16 are unsupported.

## 1. Get a clean checkout

```sh
git clone https://github.com/Nailer/portion.git
cd portion
nvm install
nvm use
npx --yes npm@11.21.1 ci
```

If you do not use nvm, install/select the pinned Node version with your runtime manager first. Confirm `node --version` and `npm --version`; pinning metadata does not automatically switch every shell. The forge-std sources are tracked in this repository, not an unresolved submodule. Do not copy an existing node_modules directory or any .env/keys from another machine.

## 2. Run the checks and production build

```sh
npm run typecheck
npm test
npm run build
```

`npm test` runs local contract, SDK, web and server suites. Four optional SDK live integration tests are skipped by default. Tests use isolated fixtures; they do not submit production/testnet writes, seed the public market or need a signing key. Foundry may download its configured Solidity compiler on a first run. `npm run build` creates the bundled API and Vite frontend; it does not deploy either or request faucet tokens.

See [SETUP-VERIFICATION.json](SETUP-VERIFICATION.json) for the exact source baseline, runtime and recorded clean-install/check results. A clean build is not real-wallet proof or an independent audit.

## 3. Preview with existing public services — no local secrets

```sh
PORTION_API_TARGET=https://portion-one.vercel.app npm run dev -w @portion/web
```

Open http://127.0.0.1:5173. Vite proxies /api to the existing hosted API, avoiding cross-origin problems without copying Blob/issuer/deployer keys. The browser still reads the real configured Portaldot testnet. Public pages and existing receipts are available without a wallet; actual transactions require the visitor's existing wallet and test tokens. **This is not a simulation or a local disposable chain.** Running the dev server itself does not sign anything.

The existing development listing 585886 is explicitly TEST ONLY and sold out. Do not fabricate an opening balance or publish another asset to prove the preview renders. This preview depends on the public RPC/API being reachable; outages must show unavailable rather than fake data.

## 4. Run your own local API — optional

`npm run dev` starts the API on 127.0.0.1:8787 and frontend on port 5173. The checked-in deployment record points to the existing Core; it is not a local contract deployment. Local Core document publication/catalog services require a separately configured Vercel Blob store token. Test-credit issuance additionally requires a separately authorized, funded issuer key with permission for the payment asset. Never use the deployer key as a shortcut.

Use .env.example as a variable-name reference and keep actual values in ignored local files. Missing Blob/issuer settings leave those services unavailable; they do not grant automatic credentials, data or balances. Legacy keeper/faucet/bridge flags apply to their separate source paths, not to an always-running hosted Core service.

## 5. Deploying and keys

No new deployment is needed to review or contribute to this project. Build/test/preview instructions above need no deployment mnemonic. Never run key generation, deployment, live-test or credit-service setup scripts merely to get the UI running. New on-chain writes require a current cost estimate and defined spending authority/reserve. See [funding boundaries](FUNDING-PROTECTION.md), [hosting](HOSTING.md) and [architecture](architecture.md).

## Third-party components

Runtime/build dependencies include React, React Router, Vite, TypeScript, Polkadot-JS APIs/keyring/utilities/extension detection, ethers, Hono, dotenv, Vercel Blob/OIDC dependencies and esbuild; test tooling includes Foundry/forge-std and Vitest. package.json and package-lock.json are the authoritative version inventory. Preserve package licences and forge-std attribution; lockfile installation and an audit report are not a blanket licence or security approval.
