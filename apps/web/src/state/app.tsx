import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Deployment } from '@portion/sdk';
import { api as serviceApi, type Backend } from '../lib/backend';
import { keccak256 } from 'ethers';
import { releaseDeployment } from '../lib/deployment-identity';

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
        const [{ connect, TESTNET, PortionCoreArtifact }, { LiveBackend }] = await Promise.all([import('@portion/sdk'), import('../lib/live')]);
        if (dead) return;
        const connection = connect(TESTNET.ws);
        let expired = false;
        connection.then(api => { if (expired || dead) void api.disconnect(); }, () => {});
        const api = await withTimeout(connection, 12_000, 'The Portaldot testnet did not answer in time.').catch(e => { expired = true; throw e; });
        cleanup = () => void api.disconnect();
        const verified = await withTimeout((async () => {
          let advertised: Deployment | null | undefined;
          try { advertised = await serviceApi<Deployment | null>('/api/deployment', { signal: AbortSignal.timeout(5000) }); } catch { /* Services may be unavailable; never replace the pinned financial identity. */ }
          const deployment = releaseDeployment(bundledDeployment,advertised);
          if (dead) throw new Error('Connection was replaced.');
          if (api.genesisHash.toHex() !== '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd') throw new Error('The RPC returned an unexpected network. Financial actions are disabled.');
          if (deployment) {
            const account = await api.query.revive.accountInfoOf(deployment.portion);
            if ((account as any).isNone) throw new Error('The configured Portion contract could not be verified on this chain.');
            if (deployment.contractVersion === 'core-v1') {
              const response = await fetch(TESTNET.evmRpc, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(6000), body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [deployment.portion, 'latest'] }) });
              const code = await response.json();
              if (!code.result || keccak256(code.result) !== keccak256(PortionCoreArtifact.runtimeBytecode)) throw new Error('Core runtime bytecode could not be verified.');
            }
            const candidate = new LiveBackend(api, deployment);
            await candidate.rules();
            const asset = await api.query.assets.asset(deployment.pusdAssetId);
            if ((asset as any).isNone) throw new Error('The configured payment asset does not exist on this chain.');
            const metadata = await api.query.assets.metadata(deployment.pusdAssetId);
            if (Number((metadata as any).decimals.toString()) !== 6) throw new Error('Payment-asset decimals differ from this Core version. Financial amounts cannot be interpreted safely.');
          }
          return new LiveBackend(api, deployment);
        })(), 20_000, 'Contract or payment-asset verification timed out. Retry the connection; financial actions remain unavailable.');
        if (dead) return;
        setBackend(verified);
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
