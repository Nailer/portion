import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

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
  const [state, set] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  useEffect(() => {
    let dead = false;
    set({ loading: true });
    fn().then(
      (data) => { if (!dead) set({ data, loading: false }); },
      (error) => { if (!dead) set({ error, loading: false }); },
    );
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
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
