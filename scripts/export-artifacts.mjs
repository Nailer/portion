// Copies ABI + creation bytecode of the deployable contracts into the SDK so that the server and web app
// never need Foundry installed. Run via `npm run contracts:build`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const names = ['Portion', 'PortionCore', 'Teleport', 'WrappedToken'];
const outDir = new URL('../packages/sdk/src/artifacts/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const n of names) {
  const a = JSON.parse(readFileSync(new URL(`../contracts/out/${n}.sol/${n}.json`, import.meta.url), 'utf8'));
  writeFileSync(new URL(`${n}.json`, outDir), JSON.stringify({ contractName: n, abi: a.abi, bytecode: a.bytecode.object, runtimeBytecode: a.deployedBytecode.object }, null, 1));
  console.log(`exported ${n}: ${(a.deployedBytecode.object.length - 2) / 2} bytes deployed`);
}
