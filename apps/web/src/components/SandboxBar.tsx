import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { usd } from '../lib/format';

const DAY = 86_400;

/** Always visible in sandbox mode: who you are acting as, the simulated clock, and the way out. */
export function SandboxBar() {
  const { backend, refresh, exitSandbox } = useApp();
  const { passport, balances, selectAccount, reloadBalances } = usePassport();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controls = backend?.sandbox;
  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await task(); refresh(); await reloadBalances(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const current = controls?.personas.find(p => p.passport === passport);
  const date = backend ? new Date(backend.now() * 1000) : null;
  return (
    <div className="sandbox-bar" role="region" aria-label="Sandbox controls">
      <div className="wrap">
        <div className="sandbox-id">
          <span className="sandbox-badge">Sandbox</span>
          <span><b>Simulated in this browser.</b> Not on Portaldot. Pretend money with no value.</span>
        </div>
        {controls ? <div className="sandbox-controls">
          <label className="sandbox-role">Acting as
            <select value={current?.key ?? ''} disabled={busy} onChange={e => { selectAccount(e.target.value); refresh(); }}>
              {controls.personas.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <span className="sandbox-money" title="This role's sandbox pUSD">{balances?.pusd != null ? usd(balances.pusd) : '…'}</span>
          <button className="btn ghost sm" disabled={busy || !passport} onClick={() => run(() => controls.addFunds(passport!.h160))}>Add 1,000 pUSD</button>
          <span className="sandbox-clock" aria-live="polite">{date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
          <button className="btn ghost sm" disabled={busy} onClick={() => run(() => controls.skip(DAY))}>+1 day</button>
          <button className="btn ghost sm" disabled={busy} onClick={() => run(() => controls.skip(7 * DAY))}>+1 week</button>
          <Link className="btn ghost sm" to="/sandbox">Demo guide</Link>
          <button className="btn dark sm" onClick={exitSandbox}>Exit sandbox</button>
        </div> : <div className="sandbox-controls"><span>Starting…</span><button className="btn dark sm" onClick={exitSandbox}>Exit sandbox</button></div>}
        {error && <p className="sandbox-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
