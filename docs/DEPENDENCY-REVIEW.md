# Dependency review — 24 October 2026

## Finding and selected fix

The starting lockfile had four high-severity audit entries from one dependency chain:
`@vercel/blob@2.5.0 → @vercel/oidc@3.8.10 → @vercel/cli-config@0.3.1 → zod@4.1.11`.

[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
describes memory exhaustion during validation of oversized constrained collections.
The advisory identifies Zod 4.6.6 as patched. The project now overrides Zod to
exactly 4.6.6 and locks its registry integrity hash. Blob, OIDC and CLI-config
versions stay unchanged. No forced audit downgrade was applied.

The application does not directly import Zod or the CLI configuration parsers.
The dependency is reachable through the Blob/OIDC package graph; this review has
not demonstrated an attacker-controlled application request reaching the affected
validator. The hosted request wrapper also bounds bodies to 65,536 bytes. Neither
observation is a substitute for patching the dependency or a full security audit.

## Reproducing the result

Use Node 24.10.0 and **npm 11.21.1**, including on Vercel:

```sh
npx --yes npm@11.21.1 ci
npx --yes npm@11.21.1 ls zod
npx --yes npm@11.21.1 audit --audit-level=high
npm run typecheck
npm run test -w @portion/sdk -w @portion/server -w @portion/web
npm run build
```

The initial package-lock-only install retained the old resolution; an explicit
`npm update zod --package-lock-only` with the pinned npm regenerated the intended
entry. A subsequent clean install resolved 4.6.6 and reported zero advisories.
The older local npm 11.6.1 can misreport the intentional override as invalid in
`npm ls`; use the documented package-manager version for dependency inspection.

Compatibility checks exercise the CLI-config schemas with synthetic values only,
plus loading the bundled API. They never read local authentication files. Contract
bytecode and protocol behaviour do not change with this patch. A clean audit
records known advisories at that time, not a guarantee against vulnerabilities.

## Browser sandbox EVM — 29 October 2026

The web app adds `@ethereumjs/evm`, `@ethereumjs/common` and `@ethereumjs/util`, each pinned to exactly **10.1.3**, to run the Core v2 bytecode in the browser sandbox ([SANDBOX.md](SANDBOX.md)). They pull in `@ethereumjs/statemanager`, `mpt`, `rlp` and `binarytree` at the same release.

- **Reach:** imported only by `apps/web/src/sandbox/`, which the app loads with a dynamic import when a visitor starts the sandbox. The production build places them in the sandbox chunk (386 kB, 124.5 kB gzipped); the entry bundle contains none of them. The server and SDK do not depend on them.
- **Data handled:** none outside the visitor's own browser. The sandbox makes no network requests, holds no keys and signs nothing.
- **Audit on 29 October 2026** with npm 11.21.1: no advisory against these packages. The only finding was one moderate advisory in `@hono/node-server` ([GHSA-rmxm-3fg6-px4f](https://github.com/advisories/GHSA-rmxm-3fg6-px4f)), which predates this change and is not reachable from the sandbox. It is recorded here, not fixed in this change.
