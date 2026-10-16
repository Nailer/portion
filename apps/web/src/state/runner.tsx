import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from './app';
import { usePassport } from './passport';
import { UserError, type ActionResult, type Intent, type Prepared, type StageName } from '../lib/backend';
import { StepList } from '../components/StepList';
import { Spinner } from '../components/ui';
import { explorerBlock, pot, usd } from '../lib/format';

type Phase = 'preparing' | 'confirm' | 'running' | 'result' | 'error';

interface Runner {
  act(intent: Intent, opts?: { onDone?: (r: ActionResult) => void }): void;
  /** Same confirm → run → result flow for actions that are not Portion intents (pools, teleport). */
  actPrepared(prepare: () => Promise<Prepared>, opts?: { onDone?: (r: ActionResult) => void }): void;
  openPassport(): void;
  passportOpen: boolean;
  closePassport(): void;
}
const Ctx = createContext<Runner>(null as any);
export const useRunner = () => useContext(Ctx);

const STAGE_COPY: Record<StageName, string> = {
  preparing: 'Preparing',
  signing: 'Signing with your Passport',
  broadcast: 'Sent to the network',
  inBlock: 'Included in a block',
  done: 'Finalized',
  failed: 'Failed',
};

export function RunnerProvider({ children }: { children: ReactNode }) {
  const { backend, refresh } = useApp();
  const { passport, reloadBalances } = usePassport();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase | null>(null);
  const [prepared, setPrepared] = useState<Prepared>();
  const [stage, setStage] = useState<StageName>('preparing');
  const [stageDetail, setDetail] = useState<string>();
  const [result, setResult] = useState<ActionResult>();
  const [error, setError] = useState<{ message: string; fix?: 'faucet' }>();
  const [passportOpen, setPassportOpen] = useState(false);
  const [dripping, setDripping] = useState(false);
  const last = useRef<{ prepare: () => Promise<Prepared>; onDone?: (r: ActionResult) => void }>();

  const close = useCallback(() => { setPhase(null); setPrepared(undefined); setResult(undefined); setError(undefined); }, []);

  const actPrepared = useCallback(async (prepare: () => Promise<Prepared>, opts?: { onDone?: (r: ActionResult) => void }) => {
    if (!backend) return;
    if (!passport) { setPassportOpen(true); return; }
    last.current = { prepare, onDone: opts?.onDone };
    setPhase('preparing'); setError(undefined); setResult(undefined);
    try {
      setPrepared(await prepare());
      setPhase('confirm');
    } catch (e) {
      setError({ message: (e as Error).message, fix: e instanceof UserError ? e.fix : undefined });
      setPhase('error');
    }
  }, [backend, passport]);

  const act = useCallback((intent: Intent, opts?: { onDone?: (r: ActionResult) => void }) => {
    if (!backend || !passport) { setPassportOpen(true); return; }
    return actPrepared(() => backend.prepare(intent, passport), opts);
  }, [backend, passport, actPrepared]);

  const run = async () => {
    if (!prepared) return;
    setPhase('running'); setStage('signing'); setDetail(undefined);
    const r = await prepared.run((s, d) => { setStage(s); setDetail(d); });
    setResult(r);
    setPhase(r.ok ? 'result' : 'error');
    if (!r.ok) setError({ message: r.error ?? 'The transaction failed.' });
    else { refresh(); void reloadBalances(); last.current?.onDone?.(r); }
  };

  const drip = async () => {
    if (!backend || !passport) return;
    setDripping(true);
    try { await backend.drip(passport.address); await reloadBalances(); refresh(); if (last.current) void actPrepared(last.current.prepare, { onDone: last.current.onDone }); }
    catch (e) { setError({ message: (e as Error).message }); }
    finally { setDripping(false); }
  };

  // Esc closes unless a transaction is in flight
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase && phase !== 'running') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, close]);

  return (
    <Ctx.Provider value={{ act, actPrepared, openPassport: () => setPassportOpen(true), passportOpen, closePassport: () => setPassportOpen(false) }}>
      {children}
      {phase && (
        <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && phase !== 'running') close(); }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            {phase === 'preparing' && <div className="sheet-center"><Spinner /><p>Checking your balances and the listing…</p></div>}

            {(phase === 'confirm' || phase === 'running') && prepared && (
              <>
                <h2 id="sheet-title">{prepared.title}</h2>
                <p className="sheet-sub">
                  One signature from your Passport. {prepared.steps.length > 1 ? 'These steps run as one unit: if any step fails, none of them happen.' : ''}
                </p>
                <StepList steps={prepared.steps} state={phase === 'running' ? 'running' : 'idle'} />
                {prepared.cost && <p className="sheet-cost">{prepared.cost}</p>}
                <div className="sheet-actions">
                  {phase === 'confirm' ? (
                    <>
                      <button className="btn ghost" onClick={close}>Cancel</button>
                      <button className="btn primary" onClick={run} autoFocus>Confirm</button>
                    </>
                  ) : (
                    <div className="progress"><Spinner /> <b>{STAGE_COPY[stage]}</b>{stageDetail ? <span>{stageDetail}</span> : null}</div>
                  )}
                </div>
              </>
            )}

            {phase === 'result' && prepared && result && (
              <>
                <h2 id="sheet-title">Done</h2>
                <p className="sheet-sub">{prepared.title} went through{result.blockNumber ? ` in block ${result.blockNumber.toLocaleString()}` : ''}.</p>
                <StepList steps={prepared.steps} state="done" />
                <ul className="tx-links">
                  {(result.txs ?? (result.txHash ? [{ label: 'Transaction', hash: result.txHash, block: result.blockNumber }] : [])).map((t) => (
                    <li key={t.hash}>
                      <span>{t.label}</span>
                      {backend?.mode === 'live' ? <a href={explorerBlock(t.block)} target="_blank" rel="noreferrer"><code>{t.hash.slice(0, 18)}…</code> view block</a> : <code>simulated</code>}
                    </li>
                  ))}
                </ul>
                <div className="sheet-actions">
                  {result.listingId !== undefined && <button className="btn primary" onClick={() => { close(); nav(`/listing/${result.listingId}`); }}>Open the listing</button>}
                  <button className={`btn ${result.listingId !== undefined ? 'ghost' : 'primary'}`} onClick={close}>Close</button>
                </div>
              </>
            )}

            {phase === 'error' && error && (
              <>
                <h2 id="sheet-title">{error.fix === 'faucet' ? 'You need a few tokens first' : 'That did not go through'}</h2>
                <p className="sheet-error">{error.message}</p>
                {passport && backend?.mode && error.fix === 'faucet' && <p className="sheet-sub">The faucet sends {pot(3n * 10n ** 14n, 0)} for fees and {usd(500n * 10n ** 6n, 0)} pUSD to your Passport.</p>}
                <div className="sheet-actions">
                  <button className="btn ghost" onClick={close}>Close</button>
                  {error.fix === 'faucet' && <button className="btn primary" disabled={dripping} onClick={drip}>{dripping ? 'Sending…' : 'Get free tokens'}</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
