import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EscrowView } from '@portion/sdk';
import { EscrowPanel, escrowTiming } from '../src/components/EscrowPanel';

const day = 86_400, cadence = 7 * day;
const escrow: EscrowView = { phase: 'Active', activated: true, reviewer: '0x' + '2e'.repeat(20), recovery: null, pendingOperator: null, pendingAfter: 0,
  deadline: 1_000, minSold: 50, raised: 1_000_000_000n, released: 500_000_000n, refundPool: 0n, refunded: 0n, escrowed: 500_000_000n,
  tranches: [5000, 5000], nextTranche: 1, lapses: 0, proposal: null, otherDeposits: 0n, reserve: 0n, windDownAfter: 0 };
const listing: any = { id: 7, operator: '0x' + 'aa'.repeat(20), cadence, totalShares: 100, vault: { sold: 100, forSale: 0 }, escrow };
const html = (e: Partial<EscrowView>, me: string | null = null, extra: { refundable?: bigint; stake?: number } = {}) =>
  renderToStaticMarkup(<EscrowPanel l={{ ...listing, escrow: { ...escrow, ...e } }} me={me} now={10 * day} act={vi.fn()} refundable={extra.refundable ?? 0n} stake={extra.stake ?? 0} />);

describe('escrow timing mirrors the contract', () => {
  const proposal = { evidence: '0x' + '11'.repeat(32), proposedAt: 0, approvedAt: day, challenged: false };
  it('allows release one period after approval and before expiry, never earlier', () => {
    expect(escrowTiming({ ...escrow, proposal }, 0, cadence, day + cadence - 1).canRelease).toBe(false);
    expect(escrowTiming({ ...escrow, proposal }, 0, cadence, day + cadence).canRelease).toBe(true);
    expect(escrowTiming({ ...escrow, proposal }, 0, cadence, 3 * cadence + 1).canRelease).toBe(false);
  });
  it('lets anyone clear a challenged or expired request', () => {
    expect(escrowTiming({ ...escrow, proposal: { ...proposal, challenged: true } }, 0, cadence, day).canLapse).toBe(true);
    expect(escrowTiming({ ...escrow, proposal }, 0, cadence, 3 * cadence + 1).canLapse).toBe(true);
    expect(escrowTiming({ ...escrow, proposal }, 0, cadence, 2 * cadence).canLapse).toBe(false);
  });
  it('settles a raise only after the deadline or a sell-out', () => {
    const funding = { ...escrow, phase: 'Funding' as const, deadline: 100 };
    expect(escrowTiming(funding, 5, cadence, 100).canFinalize).toBe(false);
    expect(escrowTiming(funding, 5, cadence, 101).canFinalize).toBe(true);
    expect(escrowTiming(funding, 0, cadence, 50).canFinalize).toBe(true);
  });
});

describe('escrow panel states what is and is not protected', () => {
  it('shows held, released and still-held money and the release schedule', () => {
    const out = html({});
    expect(out).toContain('Still held by the contract');
    expect(out).toContain('Tranche 1: 50%');
    expect(out).toContain('Released');
    expect(out).not.toMatch(/guarantee|risk-free|insured/i);
  });
  it('says plainly that released money cannot be recovered when refunding', () => {
    expect(html({ phase: 'Refunding' })).toContain('Money already released cannot be recovered');
  });
  it('offers attestation only to the named reviewer while pending', () => {
    expect(html({ phase: 'Pending' }, escrow.reviewer)).toContain('Attest and open the sale');
    expect(html({ phase: 'Pending' }, '0x' + 'bb'.repeat(20))).not.toContain('Attest and open the sale');
  });
  it('offers a challenge only to holders with at least 10% of sold shares staked', () => {
    const proposal = { evidence: '0x' + '11'.repeat(32), proposedAt: 9 * day, approvedAt: 0, challenged: false };
    expect(html({ proposal }, null, { stake: 10 })).toContain('Challenge this tranche');
    expect(html({ proposal }, null, { stake: 9 })).not.toContain('Challenge this tranche');
  });
  it('offers a refund only when one is available', () => {
    expect(html({ phase: 'Refunding' }, null, { refundable: 300_000_000n })).toContain('Take back 300');
    expect(html({ phase: 'Refunding' })).not.toContain('Take back');
  });
});
