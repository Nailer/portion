import type { IncomingMessage, ServerResponse } from 'node:http';
import { publicApi } from '../packages/server/src/public-api';
import type { Deployment } from '@portion/sdk';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'deployments/portaldot-testnet.json');
const deployment = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Deployment : undefined;
const app = publicApi(deployment);
export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const original = new URL(req.url ?? '/', 'https://portion-one.vercel.app');
  const route = original.searchParams.get('path');
  if (route) { original.pathname = '/api/' + route; original.searchParams.delete('path'); }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    else { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 65536) { res.statusCode = 413; res.end(); return; } chunks.push(bytes); } body = Buffer.concat(chunks).toString(); }
    if (body.length > 65536) { res.statusCode = 413; res.end(); return; }
  }
  const response = await app.fetch(new Request(original, { method: req.method, headers, body }));
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
