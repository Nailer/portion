import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { startRead, type ReadState } from '../lib/async-read';

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role="status" aria-label={label ?? 'Loading'} />;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data?: T; error?: Error; loading: boolean } {
  const [state, set] = useState<ReadState<T> & {source:unknown[]}>({ loading: true,source:deps });
  useEffect(() => {
    return startRead(fn,next=>set({...next,source:deps}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state.source.length!==deps.length || state.source.some((value,index)=>!Object.is(value,deps[index])) ? {loading:true} : state;
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="link-btn" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}>
      {done ? 'Copied' : label}
    </button>
  );
}

export function Crumb({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="crumb">{children}</Link>;
}
