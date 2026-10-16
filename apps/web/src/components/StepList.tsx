import type { PlanStep } from '@portion/sdk';

const LANES = {
  native: { label: 'Native module', hint: 'a Substrate pallet' },
  evm: { label: 'Solidity', hint: 'an EVM contract through pallet-revive' },
  storage: { label: 'On-chain storage', hint: 'TransactionStorage' },
} as const;

/** The "Under the hood" list: the real calls that make up one action, in the order the chain runs them. */
export function StepList({ steps, state = 'idle', atomicFrom }: { steps: PlanStep[]; state?: 'idle' | 'running' | 'done' | 'failed'; atomicFrom?: number }) {
  return (
    <ol className={`steps steps-${state}`}>
      {steps.map((s, i) => (
        <li key={s.key + i} className={`step lane-${s.lane}`} style={{ ['--i' as any]: i }}>
          <span className="step-dot" aria-hidden />
          <div className="step-body">
            <div className="step-title">{s.title}</div>
            <div className="step-detail">{s.detail}</div>
            <div className="step-call">
              <span className={`lane-chip lane-${s.lane}`} title={LANES[s.lane].hint}>{LANES[s.lane].label}</span>
              <code>{s.pallet}.{s.method}</code>
              {atomicFrom !== undefined && i === atomicFrom && <span className="atomic">atomic batch starts here</span>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
