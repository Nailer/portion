import type { ListingView } from '@portion/sdk';
import { span } from '../lib/format';
import { useApp } from '../state/app';

const LABEL: Record<ListingView['health'], string> = { Healthy: 'On time', Late: 'Late', Defaulted: 'Defaulted', WoundDown: 'Wound down' };

/** Time since the operator last paid, drawn against the two deadlines that matter: late (1×) and slashable (2×). */
export function Health({ l, compact = false }: { l: ListingView; compact?: boolean }) {
  const { backend } = useApp();
  const now = backend?.now() ?? Math.floor(Date.now() / 1000);
  const overdue = Math.max(0, now - l.lastDepositAt);
  const frac = Math.min(1, overdue / (2 * l.cadence));
  return (
    <div className={`health health-${l.health}${compact ? ' compact' : ''}`} title={`Last payment ${span(overdue)} ago. Late after ${span(l.cadence)}, slashable after ${span(2 * l.cadence)}.`}>
      <div className="health-line">
        <i className="dot" />
        <b>{LABEL[l.health]}</b>
        {!compact && l.health !== 'WoundDown' && <span>paid {span(overdue)} ago</span>}
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
