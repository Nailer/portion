import type { ListingView } from '@portion/sdk';
import { span } from '../lib/format';
import { useApp } from '../state/app';

const LABEL: Record<ListingView['health'], string> = { Healthy: 'On time', Late: 'Late', Defaulted: 'Defaulted', WoundDown: 'Wound down' };

/** Time since the operator last paid, drawn against the two deadlines that matter: late (1×) and slashable (2×). */
export function Health({ l, compact = false }: { l: ListingView; compact?: boolean }) {
  const { backend } = useApp();
  // Core v2: nothing is owed until the raise settles, so there is no payment clock to show.
  if (l.escrow && !l.escrow.activated) return <div className={`health health-Healthy${compact ? ' compact' : ''}`} title="The payment clock starts when the raise settles."><div className="health-line"><i className="dot"/><b>{l.escrow.phase === 'Refunding' ? 'Refunds open' : 'Not started'}</b>{!compact && l.escrow.phase !== 'Refunding' && <span>payments start once the raise settles</span>}</div></div>;
  const now = backend?.now() ?? Math.floor(Date.now() / 1000);
  const overdue = Math.max(0, now - l.lastDepositAt);
  const frac = Math.min(1, overdue / (2 * l.cadence));
  return (
    <div className={`health health-${l.health}${compact ? ' compact' : ''}`} title={`Payment clock last reset ${span(overdue)} ago. Late after ${span(l.cadence)}, slashable after ${span(2 * l.cadence)}.`}>
      <div className="health-line">
        <i className="dot" />
        <b>{l.health === 'Healthy' && l.vault.totalRevenue === 0n && l.lastDepositAt === l.createdAt ? 'Initial payment window' : LABEL[l.health]}</b>
        {!compact && l.health !== 'WoundDown' && <span>clock reset {span(overdue)} ago</span>}
      </div>
      {l.health !== 'WoundDown' && (
        <div className="clock" aria-hidden>
          <div className="clock-fill" style={{ width: `${frac * 100}%` }} />
          <i className="tick" style={{ left: '50%' }} />
        </div>
      )}
    </div>
  );
}
