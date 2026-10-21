import { useState } from 'react';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';

export function DemoRoles() {
  const { demoRole, switchDemoRole } = usePassport();
  const { busy: transactionBusy } = useRunner();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choose = async (role: 'operator' | 'funder') => {
    setBusy(true); setError('');
    try { await switchDemoRole(role); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="demo-roles"><span>Try both sides</span><div role="group" aria-label="Simulation role"><button disabled={busy || transactionBusy} aria-pressed={demoRole === 'operator'} onClick={() => choose('operator')}>Operator</button><button disabled={busy || transactionBusy} aria-pressed={demoRole === 'funder'} onClick={() => choose('funder')}>Funder</button></div>{error && <small role="alert">{error}</small>}</div>;
}
