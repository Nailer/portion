import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { connect, TESTNET, type Deployment } from '@portion/sdk';
import { api as serviceApi, type Backend } from '../lib/backend';
import { LiveBackend } from '../lib/live';

const bundled = import.meta.glob('../../../../deployments/portaldot-testnet.json', { eager: true, import: 'default' }) as Record<string, Deployment>;
const bundledDeployment = Object.values(bundled)[0];

interface AppState {
  backend: Backend | null;
  status: 'connecting' | 'ready' | 'offline';
  error?: string;
  reconnect(): void;
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
  const [attempt, setAttempt] = useState(0);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [status, setStatus] = useState<AppState['status']>('connecting');
  const [error, setError] = useState<string>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let dead = false;
    let cleanup: (() => void) | undefined;
    setStatus('connecting');
    setError(undefined);
    setBackend(null);
    (async () => {
      try {
        const connection = connect(TESTNET.ws);
        let expired = false;
        connection.then(api => { if (expired || dead) void api.disconnect(); }, () => {});
        const api = await withTimeout(connection, 12_000, 'The Portaldot testnet did not answer in time.').catch(e => { expired = true; throw e; });
        cleanup = () => void api.disconnect();
        let deployment: Deployment | undefined = bundledDeployment;
        try { deployment = await serviceApi<Deployment | null>('/api/deployment', { signal: AbortSignal.timeout(5000) }) ?? deployment; } catch { /* server optional for reads */ }
        if (dead) { void api.disconnect(); return; }
        if (api.genesisHash.toHex() !== '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd') throw new Error('The RPC returned an unexpected network. Financial actions are disabled.');
        if (deployment) {
          const account = await api.query.revive.accountInfoOf(deployment.portion);
          if ((account as any).isNone) throw new Error('The configured Portion contract could not be verified on this chain.');
          const candidate = new LiveBackend(api, deployment);
          await candidate.rules();
          const asset = await api.query.assets.asset(deployment.pusdAssetId);
          if ((asset as any).isNone) throw new Error('The configured payment asset does not exist on this chain.');
        }
        if (dead) return;
        setBackend(new LiveBackend(api, deployment));
        setStatus('ready');
        cleanup = () => void api.disconnect();
      } catch (e) {
        if (dead) return;
        cleanup?.();
        setError((e as Error).message);
        setStatus('offline');
      }
    })();
    return () => { dead = true; cleanup?.(); };
  }, [attempt]);

  const value = useMemo<AppState>(() => ({
    backend, status, error, tick,
    refresh: () => setTick((t) => t + 1),
    reconnect: () => setAttempt(n => n + 1),
  }), [backend, status, error, tick]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
