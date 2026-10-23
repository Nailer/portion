import { build } from 'esbuild';
await build({ entryPoints: ['serverless/handler.ts'], outfile: 'serverless/bundle.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['better-sqlite3'] });
