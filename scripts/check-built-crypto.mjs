import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// Type checks and dev mode miss cross-chunk CommonJS initialization failures.
// Load each crypto/storage entry independently, so another import cannot mask it.
const directory = new URL('../apps/web/dist/assets/', import.meta.url);
const chunks = (await readdir(directory)).filter(name => /^(asU8a|storage|addresses)-.*\.js$/.test(name));
if (chunks.length < 2) throw new Error('Expected split crypto/storage build entries were not found; update this check for a changed bundle layout.');
for (const name of chunks) {
  const url = new URL(name, directory).href;
  execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)})`], { stdio: 'pipe', timeout: 20000 });
  console.log(`Built module initializes: ${name}`);
}
