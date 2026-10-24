# Continuous checks

`.github/workflows/checks.yml` verifies pushes to main and pull requests, and can
be run manually from GitHub Actions. It uses the committed Node pin, npm 11.21.1
and Foundry 1.5.1. Action revisions are pinned to commit hashes.

Every run starts from a clean checkout, installs the lockfile, checks high/critical
known dependency advisories, type-checks scripts and workspaces, runs contract,
SDK, web and server tests, builds both API and frontend, and loads the API bundle.
The run summary identifies the checked source commit. Read step results before
claiming a pass; a summary is written even on failure.

No project secrets are passed, checkout credentials are not retained, and optional
live tests are disabled with `LIVE=0`. No deployment, faucet grant or other chain
transaction is part of CI. Compilation may download the pinned Solidity compiler.

For the same checks locally, follow [SETUP.md](SETUP.md), then run the commands
listed in the workflow. Contract tests run in isolated local EVM fixtures.

## Release gate

Publish only a commit whose **Portion checks** run passed, followed by the relevant
hosted API/browser checks. The workflow itself does not deploy. GitHub branch
protection is a separate repository setting: this file does not claim to prevent
an administrator pushing directly to main or running Vercel manually. An automatic
production deployment must depend on successful verification if added later.

## First verified run

[Run 40100120771](https://github.com/Nailer/portion/actions/runs/40100120771) passed
for commit `328277159842c583d927450925651e13b7b5f0ee` on 24 October 2026.
All 142 local-fixture tests passed; four optional live SDK tests were skipped.
The clean install, audit, type check, production builds and credential-free API
load also passed on the GitHub Linux runner.
