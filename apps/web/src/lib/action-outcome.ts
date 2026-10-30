import type { Intent } from './backend';

export interface NextLink { label: string; to: string }
export interface ActionOutcome { changed?: string; next: NextLink[] }
const PORTFOLIO: NextLink = { label: 'Open my portfolio', to: '/portfolio' };
const MANAGE: NextLink = { label: 'Manage offers', to: '/operator' };
const asset = (id: number): NextLink => ({ label: 'View the asset', to: `/listing/${id}` });

/** What a finished action actually changed, and the sensible next step. Shown only after a successful result. */
export function actionOutcome(intent: Intent | undefined, listingId?: number, escrow = false): ActionOutcome {
  switch (intent?.kind) {
    case 'buy': return { changed: `You now hold ${intent.shares.toLocaleString()} more staked share${intent.shares === 1 ? '' : 's'}, which receive future deposits. ${escrow ? 'Your payment is held by the contract until tranches are released, or refunded if the raise misses its target.' : 'Your payment went to the operator, less the 1% fee. Portion does not hold it.'}`, next: [PORTFOLIO, asset(intent.id)] };
    case 'claim': return { changed: 'Your allocated income was paid to your wallet. Your shares stay staked for future deposits.', next: [PORTFOLIO] };
    case 'deposit': return { changed: 'Your deposit was split among the shares staked now, after the 0.5% fee. Holders claim their part when they choose. A deposit at or above your stated minimum also resets your payment deadline.', next: [asset(intent.id), MANAGE] };
    case 'stake': return { changed: 'These shares now receive future deposits. They do not receive deposits made before staking.', next: [PORTFOLIO, asset(intent.id)] };
    case 'unstake': return { changed: 'These shares are back in your wallet and no longer receive future deposits. Unstaking does not return your purchase payment; income already allocated stays claimable.', next: [PORTFOLIO, asset(intent.id)] };
    case 'slash': return { changed: 'The operator’s bond was recovered: the caller received the tip and the rest went to holders.', next: [asset(intent.id), PORTFOLIO] };
    case 'topUp': return { changed: 'The operator bond held by the contract increased by this amount.', next: [asset(intent.id), MANAGE] };
    case 'operator': return { changed: intent.fn === 'withdrawBond' ? 'The remaining bond was returned to your wallet.' : intent.fn === 'windDown' ? 'The listing is closed. Income already allocated stays claimable by holders.' : 'The sale is closed. Unsold shares are no longer on offer.', next: [asset(intent.id), MANAGE] };
    case 'escrow': {
      const changed: Record<typeof intent.fn, string> = {
        attest: 'Your review is recorded and the sale is open.', finalize: 'The raise is settled. If the target was met the listing is active; if not, buyers can take their money back.',
        refund: 'Your share of the unreleased money was returned to your wallet.', cancel: 'The raise is cancelled. Buyers can take back all unreleased money.',
        propose: 'Your tranche request is recorded. The named reviewer must approve it next.', approve: 'The tranche is approved and the one-period challenge window has started.',
        challenge: 'This tranche request is challenged and will not be released.', release: 'The tranche was paid to the operator, less the 1% fee.',
        lapse: 'The failed request is cleared. A second failure opens refunds of unreleased money.', noticeWindDown: 'Notice is recorded. Holders have two periods to respond before the listing can close.',
      };
      return { changed: changed[intent.fn], next: [asset(intent.id), PORTFOLIO] };
    }
    case 'guardian': return { changed: intent.fn === 'pause' ? 'New money is paused for at most seven days. Claims, refunds and deposits keep working.' : 'The pause is lifted.', next: [] };
    case 'tokenize': return { changed: escrow ? 'Your offer is published, but no one can buy until your named reviewer attests. Ask them to review it next.' : 'Your offer is published and open for purchase. Once shares are staked, pay revenue from Manage offers before your first deadline.', next: [...(listingId !== undefined ? [{ label: 'View the offer', to: `/listing/${listingId}` }] : []), MANAGE] };
    case 'dexBuy': return { changed: 'You bought shares on the market and staked them, so they receive future deposits.', next: [PORTFOLIO, asset(intent.id)] };
    case 'dexSell': return { changed: 'Your wallet shares were sold on the market.', next: [PORTFOLIO, asset(intent.id)] };
    case 'dexSeed': return { changed: 'The market is open at your opening price. You hold the liquidity position.', next: [asset(intent.id)] };
    default: return { next: [] };
  }
}

/** Why connecting is needed for this action, shown in the wallet dialog. */
export function connectReason(intent: Intent): string {
  switch (intent.kind) {
    case 'buy': return `Connect a wallet to review buying ${intent.shares.toLocaleString()} share${intent.shares === 1 ? '' : 's'}. You will see the full cost before anything is approved.`;
    case 'tokenize': return 'Connect the wallet that will operate this offer. Your form is kept, and you will see a final review before anything is approved.';
    case 'claim': return 'Connect the wallet that holds these shares to review the claim.';
    default: return 'Connect a wallet to review this action. Nothing is approved until you confirm it.';
  }
}

export type FailureKind = 'declined' | 'failed' | 'unknown' | 'unavailable' | 'funds';
export interface FailureCopy { kind: FailureKind; title: string; happened: string; next: string }

/** Keeps a wallet refusal, a failed execution and an unknown outcome apart, because the safe next step differs. */
export function describeFailure(input: { message: string; fix?: 'faucet'; attempted: boolean; unconfirmed?: boolean; blockNumber?: number; earlierSteps?: boolean }, simulated = false): FailureCopy {
  const earlier = input.earlierSteps ? ' Earlier steps were finalized and are kept, so they will not be repeated.' : '';
  if (input.unconfirmed) return { kind: 'unknown', title: 'Outcome unknown', happened: 'We lost track of this transaction before it could be confirmed. It may or may not have gone through.', next: 'Do not repeat it. Check it in the receipt centre first; repeating could pay twice.' };
  if (input.fix === 'faucet') return { kind: 'funds', title: simulated ? 'This role needs more sandbox pUSD' : 'Not enough tokens for this action', happened: 'Nothing was sent.', next: simulated ? 'Add sandbox pUSD for this role, then review again.' : 'Check which test token you need, then review again.' };
  if (/reject|denied|cancelled|canceled/i.test(input.message)) return { kind: 'declined', title: 'You declined in your wallet', happened: `Nothing was sent for this step.${earlier}`, next: 'You can review it again whenever you are ready.' };
  if (!input.attempted) return { kind: 'unavailable', title: 'This action can’t go ahead', happened: 'Nothing was sent.', next: 'Fix what the message describes, then review again.' };
  if (input.blockNumber) return { kind: 'failed', title: 'The transaction failed', happened: `It reached finalized block ${input.blockNumber.toLocaleString()} but the action did not take effect. A network fee may still have been charged.${earlier}`, next: 'Check the reason below and your balances, then start a new review.' };
  return { kind: 'failed', title: 'The action could not be completed', happened: `It did not complete.${earlier}`, next: 'Check the reason below, then start a new review.' };
}
