import { describe, expect, it, vi, afterEach } from 'vitest';
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
