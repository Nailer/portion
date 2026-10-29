import { describe, expect, it } from 'vitest';
import { keccak256, toUtf8Bytes } from 'ethers';
import { PortionCoreV2Artifact } from '@portion/sdk/abi';
import { SandboxBackend } from '../src/sandbox/backend';
import { SandboxChain, labelAddress, saveOps, loadOps } from '../src/sandbox/chain';
import type { Intent, SandboxPersona } from '../src/lib/backend';

const U = 1_000_000n;
const DAY = 86_400, WEEK = 7 * DAY;
const ev = (text: string) => keccak256(toUtf8Bytes(text));

async function start() {
  const backend = await SandboxBackend.open();
  const role = (key: string) => backend.sandbox.personas.find(p => p.key === key)!;
  const act = async (who: SandboxPersona, intent: Intent) => {
    const prepared = await backend.prepare(intent, who.passport);
    return prepared.run(() => {});
  };
  return { backend, role, act };
}

describe('browser sandbox', () => {
  it('runs the reviewed Core v2 bytecode unchanged', async () => {
    const chain = await SandboxChain.create(1_800_000_000, [], labelAddress('guardian'));
    expect(chain.portion).toMatch(/^0x[0-9a-f]{40}$/);
    // SandboxChain.create refuses to start if the deployed code differs from this artifact.
    expect(PortionCoreV2Artifact.runtimeBytecode.length).toBeGreaterThan(20_000);
  });

  it('opens with one earning asset and one offer waiting for buyers', async () => {
    const { backend, role } = await start();
    const [solar, cold] = await backend.listings();
    expect(solar.escrow?.phase).toBe('Active');
    expect(solar.health).toBe('Healthy');
    expect(solar.vault.totalRevenue).toBeGreaterThan(0n);
    expect(solar.escrow?.nextTranche).toBe(1);
    expect(cold.escrow?.phase).toBe('Funding');
    expect(cold.saleOpen).toBe(true);
    const buyerA = await backend.positions(role('buyerA').passport.address);
    expect(buyerA.find(p => p.id === solar.id)?.pending).toBeGreaterThan(0n);
    expect((await backend.activity({ listing: solar.id })).map(a => a.kind)).toContain('RevenueDeposited');
  });

  it('walks a raise from purchase to escrow release, revenue, claim and slash', async () => {
    const { backend, role, act } = await start();
    const id = 100_002;
    expect((await act(role('buyerA'), { kind: 'buy', id, shares: 250 })).ok).toBe(true);
    expect((await act(role('buyerB'), { kind: 'buy', id, shares: 150 })).ok).toBe(true);
    let l = await backend.listing(id);
    expect(l.escrow?.raised).toBe(2_000n * U);
    expect(l.saleOpen).toBe(false);
    expect((await act(role('buyerB'), { kind: 'escrow', fn: 'finalize', id })).ok).toBe(true);
    expect((await backend.listing(id)).escrow?.phase).toBe('Active');

    // The operator cannot release money the reviewer has not approved.
    expect((await act(role('operator'), { kind: 'escrow', fn: 'propose', id, evidence: ev('invoice') })).ok).toBe(true);
    await backend.sandbox.skip(WEEK + 1);
    await expect(backend.prepare({ kind: 'escrow', fn: 'release', id }, role('operator').passport)).rejects.toThrow(/refused/i);
    expect((await act(role('reviewer'), { kind: 'escrow', fn: 'approve', id })).ok).toBe(true);
    await expect(backend.prepare({ kind: 'escrow', fn: 'release', id }, role('operator').passport)).rejects.toThrow();
    await backend.sandbox.skip(WEEK + 1);
    const before = (await backend.balances(role('operator').passport.address)).pusd!;
    // Overdue by now, so pay in first: a defaulted operator gets no tranche.
    expect((await act(role('operator'), { kind: 'deposit', id, amount: 100n * U })).ok).toBe(true);
    expect((await act(role('buyerA'), { kind: 'escrow', fn: 'release', id })).ok).toBe(true);
    l = await backend.listing(id);
    expect(l.escrow?.released).toBe(800n * U);
    // 40% of 2,000 less the 1% fee, minus the 100 deposit.
    expect((await backend.balances(role('operator').passport.address)).pusd! - before).toBe(792n * U - 100n * U);

    const pending = (await backend.positions(role('buyerA').passport.address)).find(p => p.id === id)!.pending;
    expect(pending).toBe(99_500_000n * 250n / 400n);
    expect((await act(role('buyerA'), { kind: 'claim', ids: [id] })).ok).toBe(true);

    // Two silent periods: default, then a slash one period later also refunds the unreleased escrow.
    await backend.sandbox.skip(2 * WEEK + DAY);
    expect((await backend.listing(id)).health).toBe('Defaulted');
    // C4: the operator gets one more period to cure before anyone can slash.
    await expect(backend.prepare({ kind: 'slash', id }, role('buyerB').passport)).rejects.toThrow(/Protected/);
    await backend.sandbox.skip(WEEK);
    expect((await act(role('buyerB'), { kind: 'slash', id })).ok).toBe(true);
    l = await backend.listing(id);
    expect(l.escrow?.phase).toBe('Refunding');
    const refund = (await backend.positions(role('buyerB').passport.address)).find(p => p.id === id)!.refundable!;
    expect(refund).toBe(1_200n * U * 750n / 2_000n);
    expect((await act(role('buyerB'), { kind: 'escrow', fn: 'refund', id })).ok).toBe(true);
  });

  it('refunds every buyer in full when a raise misses its target', async () => {
    const { backend, role, act } = await start();
    const id = 100_002;
    const before = (await backend.balances(role('buyerA').passport.address)).pusd!;
    expect((await act(role('buyerA'), { kind: 'buy', id, shares: 50 })).ok).toBe(true);
    await backend.sandbox.skip(15 * DAY);
    expect((await act(role('buyerA'), { kind: 'escrow', fn: 'finalize', id })).ok).toBe(true);
    expect((await backend.listing(id)).escrow?.phase).toBe('Refunding');
    expect((await act(role('buyerA'), { kind: 'escrow', fn: 'refund', id })).ok).toBe(true);
    expect((await backend.balances(role('buyerA').passport.address)).pusd).toBe(before);
  });

  it('shows refusals before confirming and blocks roles the contract forbids', async () => {
    const { backend, role } = await start();
    await expect(backend.prepare({ kind: 'buy', id: 100_002, shares: 10 }, role('operator').passport)).rejects.toThrow(/cannot buy its own listing.*Unauthorized/);
    await expect(backend.prepare({ kind: 'buy', id: 100_002, shares: 10 }, role('reviewer').passport)).rejects.toThrow(/reviewer cannot buy/);
    await backend.sandbox.addFunds(role('reviewer').passport.h160);
    // Even with money and the plain-words check bypassed, the contract itself refuses the reviewer (Invalid).
    await expect((backend as any).action('x', [], [{ op: 'call', from: role('reviewer').passport.h160, fn: 'buy', args: [100_002, 10n], approve: [{ asset: 1984, amount: '50000000' }] }])).rejects.toThrow(/Invalid/);
    await expect(backend.prepare({ kind: 'guardian', fn: 'pause' }, role('buyerA').passport)).rejects.toThrow(/Unauthorized/);
  });

  it('lets the guardian pause new money without blocking claims', async () => {
    const { backend, role, act } = await start();
    expect((await act(role('guardian'), { kind: 'guardian', fn: 'pause' })).ok).toBe(true);
    expect(await backend.sandbox.pausedUntil()).toBeGreaterThan(backend.now());
    await expect(backend.prepare({ kind: 'buy', id: 100_002, shares: 10 }, role('buyerA').passport)).rejects.toThrow(/paused/);
    expect((await act(role('buyerA'), { kind: 'claim', ids: [100_001] })).ok).toBe(true);
  });

  it('creates a new listing that waits for its named reviewer', async () => {
    const { backend, role, act } = await start();
    const reviewer = role('reviewer').passport.h160;
    const result = await act(role('operator'), { kind: 'tokenize', form: { name: 'Test Kiosk (fictional)', summary: 'Sandbox only.', category: 1, totalShares: 500, sharesForSale: 200,
      pricePusd: '2', cadenceSeconds: WEEK, minPerPeriodPusd: '5', bondPusd: '20', terms: 'Sandbox only. Fictional.', image: null,
      controls: { reviewer, minSold: 100, deadlineDays: 10, tranches: [5_000, 5_000] } } });
    expect(result.ok).toBe(true);
    const created = await backend.listing(result.listingId!);
    expect(created.name).toBe('Test Kiosk (fictional)');
    expect(created.escrow?.phase).toBe('Pending');
    expect(created.saleOpen).toBe(false);
    expect((await act(role('reviewer'), { kind: 'escrow', fn: 'attest', id: created.id, evidence: ev('site visit') })).ok).toBe(true);
    expect((await backend.listing(created.id)).saleOpen).toBe(true);
  });

  it('rebuilds the same state from its saved operation list', async () => {
    const { backend } = await start();
    const chain = (backend as any).chain as SandboxChain;
    const copy = await SandboxChain.create(chain.genesis, loadOps(saveOps(chain.ops)), labelAddress('guardian'));
    expect(copy.now).toBe(chain.now);
    expect(copy.events.map(e => e.name)).toEqual(chain.events.map(e => e.name));
    expect(String(await copy.read('escrowed', [100_001]))).toBe(String(await chain.read('escrowed', [100_001])));
  });
});
