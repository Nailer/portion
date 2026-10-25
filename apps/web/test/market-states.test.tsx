import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Home, ListingRow } from '../src/pages/Home';
const state = vi.hoisted(() => ({ status: 'connecting', backend: null as any }));
vi.mock('../src/state/app', () => ({ useApp: () => ({ ...state, reconnect: vi.fn(), tick: 0 }) }));
vi.mock('../src/state/runner', () => ({ useRunner: () => ({ openPassport: vi.fn() }) }));
const listing: any = { id: 585886, name: 'Fixture asset', summary: 'Fixture summary', category: 0, cadence: 604800, totalShares: 100,
  saleOpen: false, health: 'Healthy', lastDepositAt: 1, coverHash: '0xfixture', minPerPeriod: 1000000n,
  vault: { salePrice: 1000000n, sold: 10, forSale: 0, totalRevenue: 0n, bond: 5000000n } };
beforeEach(() => { state.status = 'connecting'; state.backend = null; });
describe('honest market states', () => {
  it('shows connection checking without claiming the deployed contract is absent', () => {
    const html = renderToStaticMarkup(<MemoryRouter><Home/></MemoryRouter>);
    expect(html).toContain('CHECKING TESTNET');
    expect(html).not.toContain('MARKET NOT DEPLOYED');
    expect(html).not.toContain('No listings are published.');
  });
  it('keeps the native asset identifier and reports purchased shares after closure without inventing a funding percentage', () => {
    state.backend = { docUrl: () => '/verified-image', now: () => 2 };
    const html = renderToStaticMarkup(<MemoryRouter><ListingRow l={listing}/></MemoryRouter>);
    expect(html).toContain('ASSET 585886');
    expect(html).not.toContain('585887');
    expect(html).toContain('10 shares purchased');
    expect(html).toContain('Sale closed');
    expect(html).not.toContain('% of');
  });
});
