import { describe, expect, it } from 'vitest';
import { reserveCredits, type CreditState, type CreditStore } from '../src/credit-control';
function storeFixture() {
  let current: { state: CreditState; etag: string } | null = null; let revision = 0;
  const store: CreditStore = {
    load: async () => current ? structuredClone(current) : null,
    save: async (state, etag) => { await Promise.resolve(); if (current ? current.etag !== etag : etag !== undefined) throw new Error('Precondition failed'); current = { state: structuredClone(state), etag: String(++revision) }; return current.etag; },
  };
  return { store, read: () => current };
}
describe('durable credit reservation', () => {
  it('allows one in-flight signer across competing serverless instances', async () => {
    const { store, read } = storeFixture();
    const attempts = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => reserveCredits(store, `address-${i}`, '2026-10-25')));
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(read()?.state.attempts).toBe(1);
    await expect(reserveCredits(store, 'later', '2026-10-25')).rejects.toThrow('pending');
  });
  it('retains an unknown request across midnight and never takes over an expired lease', async () => {
    const { store } = storeFixture(); await reserveCredits(store, 'address', '2026-10-25');
    await expect(reserveCredits(store, 'another', '2026-10-26')).rejects.toThrow('reconciled');
  });
  it('enforces account/day and global attempts with durable state and resets only settled days', async () => {
    const { store, read } = storeFixture();
    for (let i = 0; i < 20; i++) { const lease = await reserveCredits(store, `address-${i}`, '2026-10-25'); await lease.finish(); }
    await expect(reserveCredits(store, 'address-0', '2026-10-25')).rejects.toThrow('already reserved');
    await expect(reserveCredits(store, 'extra', '2026-10-25')).rejects.toThrow('limit');
    const next = await reserveCredits(store, 'address-0', '2026-10-26'); await next.finish();
    expect(read()?.state.attempts).toBe(1);
    await expect(reserveCredits(store, 'stale', '2026-10-25')).rejects.toThrow('crossed a daily reset');
  });
  it('counts legacy daily reservations and rejects stale finalization writes', async () => {
    const { store } = storeFixture();
    await expect(reserveCredits(store, 'old', '2026-10-25', ['old'])).rejects.toThrow('already reserved');
    const lease = await reserveCredits(store, 'new', '2026-10-25', ['old']); await lease.finish();
    const next = await reserveCredits(store, 'another', '2026-10-25');
    await expect(lease.finish()).rejects.toThrow('Precondition');
    await next.finish();
  });
});
