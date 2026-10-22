import { describe, expect, it, vi, afterEach } from 'vitest';
import { contentHash } from '@portion/sdk';
import { LiveBackend } from '../src/lib/live';
import { usd } from '../src/lib/format';

vi.mock('@portion/sdk', async importOriginal => ({
  ...await importOriginal<object>(),
  nativeFree: vi.fn(async () => 500n * 10n ** 14n),
}));
afterEach(() => vi.unstubAllGlobals());
describe('live data integrity', () => {
  it('reads native funds without inventing an undeployed payment-token balance', async () => {
    const backend = new LiveBackend({} as any);
    expect(await backend.balances('public-address')).toEqual({ pot: 500n * 10n ** 14n, pusd: null });
    expect(usd(null)).toBe('Unavailable');
    expect(usd(0n)).toBe('0 pUSD');
  });
  it('does not present an undeployed market as a verified empty market', () => {
    const backend = new LiveBackend({} as any);
    expect(() => backend.listings()).toThrow('not deployed');
    expect(() => backend.positions('public-address')).toThrow('not deployed');
  });
  it('reports unavailable indexed history instead of inventing no activity or no revenue', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Service unreachable'); }));
    const backend = new LiveBackend({} as any);
    await expect(backend.activity({})).rejects.toThrow('Service unreachable');
    await expect(backend.revenue(1)).rejects.toThrow('Service unreachable');
  });
});

describe('terms integrity at the browser boundary', () => {
  it('only accepts document JSON whose bytes match the listing hash', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ terms: 'Actual operator terms' }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes)));
    const backend = new LiveBackend({} as any);
    expect(await backend.docJson(contentHash(bytes))).toEqual({ terms: 'Actual operator terms' });
    expect(await backend.docJson('0x' + '00'.repeat(32))).toBeNull();
  });
});
