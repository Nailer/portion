# Public preview hosting

Public URL: https://portion-one.vercel.app. Source repository: https://github.com/Nailer/portion. Vercel project: `pleasants-projects/portion`. Production deployment `dpl_32iQqwKSqKWWJSDCfGKmBsvhBrcD` built from source commit `f7d5bc8` on 21 October 2026.

CLI publishing is working. Vercel's attempt to connect the GitHub repository was rejected for missing repository access, so automatic deployments on Git pushes are not enabled. Grant the Vercel GitHub integration access to `Nailer/portion` and reconnect it to enable that workflow. Until then, publish authorised updates with `vercel deploy --prod --scope pleasants-projects`.

The repository root contains `vercel.json`. Vercel installs the workspace with `npm ci`, builds `@portion/web` with `VITE_DEFAULT_MODE=demo`, and serves `apps/web/dist`. The SPA rewrite lets direct links such as `/guide` and `/operator` load correctly.

New visitors start in a labelled browser simulation. A saved mode choice is respected. `?demo` explicitly selects simulation; `?live` explicitly selects the live testnet. Neither changes deployment status. No deployment wallet keys belong in Vercel environment variables, and no blockchain transactions run during the web build.

This publishes the frontend. It does **not** publish the persistent Hono/SQLite API, indexer, gateway, keepers or bridge relayer. Those require a separately hosted service and configured API routing before public live use. The browser can connect directly to Portaldot for supported reads, but Portion's core contracts are not deployed yet. Vercel hosting is not evidence of a blockchain deployment.

`.vercelignore` excludes local environment files, database files, installed dependencies and Foundry build/cache outputs from CLI uploads. `.vercel/` remains Git-ignored. The GitHub repository must not include deployment mnemonics or private operational keys.

Before publishing, run `npm test`, `npm run typecheck`, and `VITE_DEFAULT_MODE=demo npm run build -w @portion/web`. After publishing, test direct routes and complete the operator → funder → payment → claim journey in the deployed site. See [WALKTHROUGH.md](WALKTHROUGH.md).
