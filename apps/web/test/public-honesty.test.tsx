import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HeroStory } from '../src/components/HeroStory';
import { Evidence } from '../src/pages/Evidence';
import { Guide } from '../src/pages/Guide';
import { Home } from '../src/pages/Home';
import { Health } from '../src/components/Health';
import { RECORDED } from '../src/lib/evidence';

const state = vi.hoisted(() => ({ status: 'ready', backend: null as any, sandbox: false }));
vi.mock('../src/state/app', () => ({ useApp: () => ({ ...state, reconnect: vi.fn(), tick: 0 }) }));
vi.mock('../src/state/runner', () => ({ useRunner: () => ({ openPassport: vi.fn() }) }));
vi.mock('../src/state/passport', () => ({ usePassport: () => ({ passport: null, balances: null }) }));

const soldOut: any = { id: 585886, name: 'Fixture asset', summary: 'Fixture summary', category: 0, cadence: 604800, totalShares: 100,
  saleOpen: false, health: 'Healthy', lastDepositAt: 1, createdAt: 1, coverHash: '0xfixture', minPerPeriod: 1000000n,
  vault: { salePrice: 1000000n, sold: 100, forSale: 0, totalRevenue: 995000n, bond: 5000000n, totalStaked: 0n } };
beforeEach(() => { state.status = 'ready'; state.backend = { deployed: true, now: () => 2, docUrl: () => '/img', listings: async () => [soldOut], rules: async () => ({ saleFeeBps: 100, revenueFeeBps: 50 }) }; });

describe('the explanatory animation cannot be mistaken for a record', () => {
  const html = renderToStaticMarkup(<HeroStory/>);
  it('labels itself an illustration and offers a pause control', () => {
    expect(html).toContain('Illustration · not a live record');
    expect(html).toContain('Pause animation');
  });
  it('shows no amounts, currency or returns', () => {
    expect(html).not.toMatch(/\$|pUSD|tPOT|\d+\s?%|return of|profit|yield|APY|guarantee(?!d)/i);
  });
  it('carries the full explanation as text for people who do not see the animation', () => {
    expect(html).toContain('Portion does not collect or see that income');
    expect(html).toContain('Nothing is paid out until the holder acts');
  });
});

describe('public pages keep their disclosures', () => {
  it('home states the test-token scope and that purchase money is not escrowed', () => {
    const html = renderToStaticMarkup(<MemoryRouter><Home/></MemoryRouter>);
    expect(html).toContain('Test tokens only');
    expect(html).toContain('This is not escrow');
    expect(html).toContain('Held for spending control');
    expect(html).not.toMatch(/guaranteed (return|income|profit)|risk-free|insured/i);
  });
  it('a raise that has not settled shows no payment clock, because nothing is owed yet', () => {
    const html = renderToStaticMarkup(<Health l={{ ...soldOut, lastDepositAt: 0, escrow: { phase: 'Funding', activated: false } }}/>);
    expect(html).toContain('Not started');
    expect(html).not.toMatch(/clock reset|Defaulted|Late/);
  });
  it('home leads with the two product actions, and guides are not primary', () => {
    const html = renderToStaticMarkup(<MemoryRouter><Home/></MemoryRouter>);
    const hero = html.slice(0, html.indexOf('pv-hero-note'));
    expect(hero).toContain('href="/assets"');
    expect(hero).toContain('Explore assets');
    expect(hero).toContain('href="/create"');
    expect(hero).toContain('Create an offer');
    expect(hero).not.toMatch(/guide|walk through|walkthrough/i);
    expect(html.indexOf('record-title')).toBeLessThan(html.indexOf('how-title'));
  });
  it('home never claims Portaldot transactions while in the sandbox', () => {
    state.sandbox = true;
    try {
      const html = renderToStaticMarkup(<MemoryRouter><Home/></MemoryRouter>);
      expect(html).not.toContain('Every step is a visible transaction on the Portaldot test network');
      expect(html).toContain('Nothing here reaches Portaldot');
      expect(html).toContain('describe the live Core v1 deployment on Portaldot, not the sandbox');
    } finally { state.sandbox = false; }
  });
  it('evidence says one account played both roles and lists every recorded hash', () => {
    const html = renderToStaticMarkup(<MemoryRouter><Evidence/></MemoryRouter>);
    expect(html).toContain('One account, both roles');
    for (const step of RECORDED.steps) expect(html).toContain(step.hash.slice(0, 12));
    expect(html).toContain(RECORDED.core.address);
  });
  it('guide gives a cost and a next step for every operator and participant step', () => {
    const html = renderToStaticMarkup(<MemoryRouter><Guide/></MemoryRouter>);
    expect((html.match(/What it costs/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect((html.match(/What happens next/g) ?? []).length).toBeGreaterThanOrEqual(10);
    expect(html).toContain('estimates, not enforced caps');
    expect(html).not.toMatch(/MetaMask/i);
  });
});
