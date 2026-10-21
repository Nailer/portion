import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { connect, TESTNET, type Deployment } from '@portion/sdk';
import type { Backend } from '../lib/backend';
import { LiveBackend } from '../lib/live';
import { DemoBackend } from '../demo/engine';
import { initialDemoMode } from '../lib/start-mode';

const bundled = import.meta.glob('../../../../deployments/portaldot-testnet.json', { eager: true, import: 'default' }) as Record<string, Deployment>;
const bundledDeployment = Object.values(bundled)[0];

interface AppState {
  backend: Backend | null;
  status: 'connecting' | 'ready' | 'offline';
  error?: string;
  forceDemo(on: boolean): void;
  /** bumps after any successful action so pages refetch */
  tick: number;
  refresh(): void;
}

const Ctx = createContext<AppState>(null as any);
export const useApp = () => useContext(Ctx);

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(msg)), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(() => initialDemoMode(location.search, localStorage.getItem('portion.demo'), import.meta.env.VITE_DEFAULT_MODE));
  const [backend, setBackend] = useState<Backend | null>(null);
  const [status, setStatus] = useState<AppState['status']>('connecting');
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  useEffect(() => { localStorage.setItem('portion.demo', demo ? '1' : '0'); }, [demo]);

  useEffect(() => {
    let dead = false;
    let cleanup: (() => void) | undefined;
    setStatus('connecting');
    setBackend(null);
    (async () => {
      if (demo) {
        const d = new DemoBackend();
        cleanup = d.subscribe(() => setTick((t) => t + 1));
        if (!dead) { setBackend(d); setStatus('ready'); }
        return;
      }
      try {
        const api = await withTimeout(connect(TESTNET.ws), 12_000, 'The Portaldot testnet did not answer in time.');
        let deployment: Deployment | undefined = bundledDeployment;
        try { const r = await fetch('/api/deployment'); if (r.ok) deployment = (await r.json()) ?? deployment; } catch { /* server optional for reads */ }
        if (dead) { void api.disconnect(); return; }
        setBackend(new LiveBackend(api, deployment));
        setStatus('ready');
        cleanup = () => void api.disconnect();
      } catch (e) {
        if (dead) return;
        setError((e as Error).message);
        setStatus('offline');
      }
    })();
    return () => { dead = true; cleanup?.(); };
  }, [demo]);

  const value = useMemo<AppState>(() => ({
    backend, status, error, tick,
    refresh: () => setTick((t) => t + 1),
    forceDemo: (on) => { localStorage.setItem('portion.demo', on ? '1' : '0'); setDemo(on); },
  }), [backend, status, error, tick]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
