import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { actionOutcome, connectReason, describeFailure } from '../src/lib/action-outcome';
import { isDevelopmentTest, offerStatus } from '../src/lib/offer-status';
import { TransactionSheet, TransactionTray, type SheetProps } from '../src/components/TransactionSheet';
import { Position } from '../src/pages/Listing';

// Fixtures for automated checks only. They are never rendered by the product.
const fixture = (over: any = {}): any => ({ id: 585886, name: 'Fixture asset', saleOpen: false, health: 'Healthy', totalShares: 100, escrow: undefined, operator: '0xop',
  vault: { sold: 100, forSale: 0, salePrice: 1_000_000n, bond: 5_000_000n, totalStaked: 0n, totalRevenue: 995_000n }, ...over });

describe('offer states mean one thing each', () => {
  it('tells sold out from sale closed, and neither can be bought', () => {
    expect(offerStatus(fixture())).toMatchObject({ key: 'sold-out', label: 'Sold out', canBuy: false });
    expect(offerStatus(fixture({ vault: { ...fixture().vault, sold: 40 } }))).toMatchObject({ key: 'closed', label: 'Sale closed', canBuy: false });
  });
  it('only an open offer with inventory and a current operator can be bought', () => {
    const vault = { ...fixture().vault, sold: 10, forSale: 30 };
    expect(offerStatus(fixture({ saleOpen: true, vault }))).toMatchObject({ key: 'open', label: '30 available', canBuy: true });
    expect(offerStatus(fixture({ saleOpen: true, vault, health: 'Defaulted' }))).toMatchObject({ key: 'blocked', canBuy: false });
    expect(offerStatus(fixture({ saleOpen: true, vault, health: 'WoundDown' }))).toMatchObject({ key: 'wound-down', canBuy: false });
  });
  it('never reports an escrow listing as buyable outside funding', () => {
    for (const phase of ['Pending', 'Active', 'Refunding']) expect(offerStatus(fixture({ escrow: { phase }, saleOpen: false })).canBuy).toBe(false);
    expect(offerStatus(fixture({ escrow: { phase: 'Funding' }, saleOpen: false, vault: { ...fixture().vault, forSale: 5 } })).key).toBe('deadline-passed');
  });
  it('discloses the development test asset', () => {
    expect(isDevelopmentTest(585886)).toBe(true);
    expect(isDevelopmentTest(100001)).toBe(false);
  });
});

describe('a sold-out asset offers only what this account can do', () => {
  const render = (over: any) => renderToStaticMarkup(<MemoryRouter><Position l={fixture()} connected unavailable={false} isOperator={false} staked={0} spare={0n} pending={0n} refundable={0n} act={vi.fn()} connect={vi.fn()} canBuy={false} hasPool={false} {...over}/></MemoryRouter>);
  it('a visitor can connect, and is promised nothing', () => {
    const html = render({ connected: false });
    expect(html).toContain('Connect wallet to check');
    expect(html).not.toMatch(/Claim|Stake|Buy/);
  });
  it('an account with no shares is told there is nothing to buy, with no trading suggested', () => {
    const html = render({});
    expect(html).toContain('This account holds no shares');
    expect(html).toContain('nothing to buy here');
    expect(html).not.toMatch(/Claim|Stake |Move /);
  });
  it('a wallet holder can stake, and is told unstaked shares are not earning', () => {
    const html = render({ spare: 7n });
    expect(html).toContain('Stake 7 wallet shares');
    expect(html).toContain('not earning');
    expect(html).not.toContain('Claim ');
  });
  it('a staker with income can claim and unstake', () => {
    const html = render({ staked: 5, pending: 2_000_000n });
    expect(html).toContain('Claim 2 pUSD');
    expect(html).toContain('Move 5 shares to my wallet');
    expect(html).toContain('not your purchase payment');
  });
  it('a defaulted v1 listing does not offer staking', () => {
    expect(renderToStaticMarkup(<MemoryRouter><Position l={fixture({ health: 'Defaulted' })} connected unavailable={false} isOperator={false} staked={0} spare={7n} pending={0n} refundable={0n} act={vi.fn()} connect={vi.fn()} canBuy={false} hasPool={false}/></MemoryRouter>)).not.toContain('Stake');
  });
  it('the operator is pointed at management', () => {
    const html = render({ isOperator: true });
    expect(html).toContain('You operate this asset');
    expect(html).toContain('Manage offers');
  });
  it('an unreadable account shows no amounts', () => {
    const html = render({ unavailable: true, staked: 5, pending: 2_000_000n });
    expect(html).toContain('could not be read');
    expect(html).not.toContain('2 pUSD');
  });
});

describe('failures keep their safe next step apart', () => {
  it('a wallet refusal says nothing was sent', () => {
    const copy = describeFailure({ message: 'Cancelled', attempted: true });
    expect(copy.kind).toBe('declined');
    expect(copy.happened).toContain('Nothing was sent');
  });
  it('an unknown outcome warns against repeating', () => {
    const copy = describeFailure({ message: 'Transaction tracking timed out', attempted: true, unconfirmed: true });
    expect(copy.kind).toBe('unknown');
    expect(copy.next).toMatch(/Do not repeat/);
  });
  it('an execution failure names the block and the fee', () => {
    const copy = describeFailure({ message: 'Contract reverted', attempted: true, blockNumber: 42 });
    expect(copy.kind).toBe('failed');
    expect(copy.happened).toContain('block 42');
    expect(copy.happened).toContain('network fee');
  });
  it('keeps earlier finalized steps in view', () => {
    expect(describeFailure({ message: 'User rejected', attempted: true, earlierSteps: true }).happened).toContain('Earlier steps were finalized');
  });
  it('a refused review sent nothing', () => {
    expect(describeFailure({ message: 'This sale is closed.', attempted: false })).toMatchObject({ kind: 'unavailable', happened: 'Nothing was sent.' });
  });
});

describe('outcomes say what changed', () => {
  it('a purchase distinguishes staked shares from where the money went', () => {
    expect(actionOutcome({ kind: 'buy', id: 1, shares: 2 }).changed).toMatch(/2 more staked shares.*went to the operator/);
    expect(actionOutcome({ kind: 'buy', id: 1, shares: 2 }, undefined, true).changed).toContain('held by the contract');
  });
  it('unstaking says the payment is not returned', () => {
    expect(actionOutcome({ kind: 'unstake', id: 1, amount: 1 }).changed).toContain('does not return your purchase payment');
  });
  it('publishing links to the actual offer', () => {
    expect(actionOutcome({ kind: 'tokenize', form: {} as any }, 9).next[0]).toEqual({ label: 'View the offer', to: '/listing/9' });
  });
  it('connecting explains why', () => {
    expect(connectReason({ kind: 'buy', id: 1, shares: 3 })).toContain('buying 3 shares');
  });
});

describe('transaction sheet', () => {
  const prepared: any = { title: 'Buy 2 shares of Fixture', cost: 'You pay 2 pUSD.', steps: [{ key: 'buy', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Buy', detail: 'd' }], run: vi.fn() };
  const base: SheetProps = { phase: 'confirm', prepared, stage: 'signing', reached: [], simulated: false, outcome: { next: [] }, publishing: false, onConfirm: vi.fn(), onDismiss: vi.fn(), onNavigate: vi.fn(), onPublish: vi.fn() };
  const render = (over: Partial<SheetProps>) => renderToStaticMarkup(<TransactionSheet {...base} {...over}/>);
  const hash = `0x${'ab'.repeat(32)}`;
  it('shows action, amount and approval before anything is sent', () => {
    const html = render({ account: { label: '', address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' } });
    expect(html).toContain('Buy 2 shares of Fixture');
    expect(html).toContain('You pay 2 pUSD.');
    expect(html).toContain('Approve in wallet');
    expect(html).not.toContain('Finalized');
  });
  it('marks only observed stages and never claims finality early', () => {
    const html = render({ phase: 'running', stage: 'inBlock', reached: ['signing', 'broadcast', 'inBlock'] });
    expect(html).toContain('Included in a block, awaiting finality');
    expect(html).toMatch(/data-state="done">Submitted/);
    expect(html).toMatch(/data-state="waiting">Finalized/);
    expect(html).toContain('Hide this window');
  });
  it('keeps the result readable and the hash in expandable details', () => {
    const html = render({ phase: 'result', result: { ok: true, txHash: hash, blockNumber: 7 }, outcome: { changed: 'You now hold 2 more staked shares.', next: [{ label: 'Open my portfolio', to: '/portfolio' }] } });
    expect(html).toContain('Finalized in block 7');
    expect(html).toContain('What changed');
    expect(html).toContain('Open my portfolio');
    expect(html.indexOf('What changed')).toBeLessThan(html.indexOf(hash));
    expect(html.slice(html.lastIndexOf('<details', html.indexOf(hash)), html.indexOf(hash))).toContain('Receipt details');
  });
  it('a simulated result never claims finality or links to the explorer', () => {
    const html = render({ phase: 'result', simulated: true, result: { ok: true, txHash: hash, blockNumber: 7 }, outcome: { next: [] } });
    expect(html).toContain('Done in the sandbox only');
    expect(html).not.toContain('Finalized');
    expect(html).not.toContain('View block');
    expect(html).not.toContain('View the receipt');
  });
  it('an unknown outcome sends people to verification and offers no retry', () => {
    const html = render({ phase: 'error', result: { ok: false, unconfirmed: true, txHash: hash }, error: { message: 'Transaction tracking timed out' }, onRetry: vi.fn() });
    expect(html).toContain('Outcome unknown');
    expect(html).toContain('Check in the receipt centre');
    expect(html).not.toContain('Review again');
  });
  it('a hidden transaction keeps its status visible and cannot be dismissed until it ends', () => {
    const running = renderToStaticMarkup(<TransactionTray title="Buy" phase="running" stage="broadcast" simulated={false} onOpen={vi.fn()} onDismiss={vi.fn()}/>);
    expect(running).toContain('Submitted to the network');
    expect(running).not.toContain('Dismiss');
    expect(renderToStaticMarkup(<TransactionTray title="Buy" phase="result" stage="done" simulated={false} kind="ok" onOpen={vi.fn()} onDismiss={vi.fn()}/>)).toContain('Dismiss this status');
  });
});
