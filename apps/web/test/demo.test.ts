import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Passport } from '@portion/sdk';
import { DemoBackend } from '../src/demo/engine';
import type { Intent, TokenizeForm } from '../src/lib/backend';

const operator = { address: 'operator', h160: '0x1111111111111111111111111111111111111111' } as Passport;
const alice = { address: 'alice', h160: '0x2222222222222222222222222222222222222222' } as Passport;
const form: TokenizeForm = { name: 'Pilot solar array', summary: 'A simulated operator-owned array', category: 0, totalShares: 100, sharesForSale: 100, pricePusd: '10', cadenceSeconds: 604800, minPerPeriodPusd: '20', bondPusd: '50', terms: 'Test terms', image: null };
let backend: DemoBackend;
async function run(intent: Intent, who = operator) {
  const prepared = await backend.prepare(intent, who);
  const result = prepared.run(() => {});
  await vi.runAllTimersAsync();
  return result;
}
async function create() {
  const result = await run({ kind: 'tokenize', form });
  expect(result.ok).toBe(true);
  return result.listingId!;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T12:00:00Z')); backend = new DemoBackend(); });
afterEach(() => vi.useRealTimers());

describe('simulation accountability', () => {
  it('only a qualifying operator deposit resets the clock', async () => {
    const id = await create();
    await run({ kind: 'buy', id, shares: 10 }, alice);
    backend.advance(604801);
    const before = (await backend.listing(id)).lastDepositAt;
    await run({ kind: 'deposit', id, amount: 30_000_000n }, alice);
    expect((await backend.listing(id)).lastDepositAt).toBe(before);
    expect((await backend.listing(id)).health).toBe('Late');
    await run({ kind: 'deposit', id, amount: 1_000_000n });
    expect((await backend.listing(id)).lastDepositAt).toBe(before);
    await run({ kind: 'deposit', id, amount: 20_000_000n });
    expect((await backend.listing(id)).health).toBe('Healthy');
  });
  it('blocks wind-down with earning shares and preserves default slashing', async () => {
    const id = await create();
    await run({ kind: 'buy', id, shares: 10 }, alice);
    await expect(backend.prepare({ kind: 'operator', id, fn: 'windDown' }, operator)).rejects.toThrow('remain staked');
    backend.advance(2 * 604800 + 1);
    await expect(backend.prepare({ kind: 'operator', id, fn: 'windDown' }, operator)).rejects.toThrow('remain staked');
    expect((await run({ kind: 'slash', id }, alice)).ok).toBe(true);
    expect((await backend.positions(alice.address))[0].pending).toBeGreaterThan(0n);
  });
  it('cannot close an overdue bond even when no one is staked', async () => {
    const id = await create();
    backend.advance(2 * 604800 + 1);
    await expect(backend.prepare({ kind: 'operator', id, fn: 'windDown' }, operator)).rejects.toThrow('must be slashed');
    await run({ kind: 'slash', id }, alice);
    expect((await run({ kind: 'operator', id, fn: 'windDown' })).ok).toBe(true);
  });
  it('returns unsold shares, blocks reopening, and retains earned claims', async () => {
    const id = await create();
    await run({ kind: 'buy', id, shares: 10 }, alice);
    await run({ kind: 'deposit', id, amount: 20_000_000n });
    await run({ kind: 'unstake', id, amount: 10 }, alice);
    const pending = (await backend.positions(alice.address))[0].pending;
    expect((await run({ kind: 'operator', id, fn: 'windDown' })).ok).toBe(true);
    expect(await backend.shareBalance(200000 + id, operator.address)).toBe(90n);
    await expect(backend.prepare({ kind: 'stake', id, amount: 1 }, operator)).rejects.toThrow('wound down');
    await expect(backend.prepare({ kind: 'topUp', id, amount: 1_000_000n }, operator)).rejects.toThrow('wound down');
    await expect(backend.prepare({ kind: 'operator', id, fn: 'withdrawBond' }, operator)).rejects.toThrow('closing wait');
    backend.advance(2 * 604800);
    expect((await run({ kind: 'operator', id, fn: 'withdrawBond' })).ok).toBe(true);
    const before = (await backend.balances(alice.address)).pusd;
    await run({ kind: 'claim', ids: [id] }, alice);
    expect((await backend.balances(alice.address)).pusd - before).toBe(pending);
  });
  it('rejects operator actions from other accounts without changing funds', async () => {
    const id = await create();
    const before = await backend.balances(alice.address);
    await expect(backend.prepare({ kind: 'topUp', id, amount: 10_000_000n }, alice)).rejects.toThrow('Only');
    await expect(backend.prepare({ kind: 'operator', id, fn: 'windDown' }, alice)).rejects.toThrow('Only');
    expect(await backend.balances(alice.address)).toEqual(before);
  });
});

describe('simulation transaction safety', () => {
  it('credits the operator and treasury with the actual sale and payment splits', async () => {
    const id = await create();
    const operatorBefore = (await backend.balances(operator.address)).pusd;
    const treasury = backend.deployment.treasury;
    const treasuryBefore = (await backend.balances(treasury)).pusd;
    await run({ kind: 'buy', id, shares: 10 }, alice);
    expect((await backend.balances(operator.address)).pusd - operatorBefore).toBe(99_000_000n);
    expect((await backend.balances(treasury)).pusd - treasuryBefore).toBe(1_000_000n);
    await run({ kind: 'deposit', id, amount: 20_000_000n });
    expect((await backend.balances(treasury)).pusd - treasuryBefore).toBe(1_100_000n);
    expect((await backend.positions(alice.address))[0].pending).toBe(19_900_000n);
  });
  it('rejects stale confirmations and duplicate submissions without debiting twice', async () => {
    const id = await create();
    const first = await backend.prepare({ kind: 'buy', id, shares: 10 }, alice);
    const stale = await backend.prepare({ kind: 'buy', id, shares: 10 }, alice);
    const submitted = first.run(() => {}); await vi.runAllTimersAsync();
    expect((await submitted).ok).toBe(true);
    const balance = (await backend.balances(alice.address)).pusd;
    expect((await first.run(() => {})).ok).toBe(false);
    const second = stale.run(() => {}); await vi.runAllTimersAsync();
    expect(await second).toMatchObject({ ok: false, error: expect.stringContaining('changed') });
    expect((await backend.balances(alice.address)).pusd).toBe(balance);
    expect((await backend.listing(id)).vault.sold).toBe(10);
  });
  it('rejects invalid amounts and insufficient funds before changing the ledger', async () => {
    const id = await create();
    const listing = structuredClone(await backend.listing(id));
    for (const intent of [
      { kind: 'buy', id, shares: -1 }, { kind: 'buy', id, shares: 1.5 },
      { kind: 'deposit', id, amount: -1n }, { kind: 'topUp', id, amount: 999999999999n },
      { kind: 'unstake', id, amount: -1 }, { kind: 'stake', id, amount: 0 },
    ] as Intent[]) await expect(backend.prepare(intent, operator)).rejects.toThrow();
    expect(await backend.listing(id)).toEqual(listing);
  });
});

describe('operator-to-funder walkthrough', () => {
  it('creates, funds, deposits and claims across separate accounts with a complete record', async () => {
    const id = await create();
    const operatorAfterBond = (await backend.balances(operator.address)).pusd;
    const funderBefore = (await backend.balances(alice.address)).pusd;
    expect((await run({ kind: 'buy', id, shares: 10 }, alice)).ok).toBe(true);
    expect((await backend.balances(operator.address)).pusd).toBe(operatorAfterBond + 99_000_000n);
    expect((await run({ kind: 'deposit', id, amount: 20_000_000n })).ok).toBe(true);
    const position = (await backend.positions(alice.address)).find(p => p.id === id)!;
    expect(position.staked).toBe(10);
    expect(position.pending).toBe(19_900_000n);
    expect((await run({ kind: 'claim', ids: [id] }, alice)).ok).toBe(true);
    expect((await backend.balances(alice.address)).pusd).toBe(funderBefore - 100_000_000n + 19_900_000n);
    expect((await backend.positions(alice.address)).find(p => p.id === id)?.pending).toBe(0n);
    expect((await backend.activity({ listing: id })).map(a=>a.kind)).toEqual(['Claimed','RevenueDeposited','Bought','Listed']);
    expect((await backend.activity({ actor: alice.h160.toLowerCase() })).map(a=>a.kind)).toEqual(['Claimed','Bought']);
  });
});
