import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from './app';
import { usePassport } from './passport';
import { UserError, type ActionResult, type Intent, type Prepared, type StageName } from '../lib/backend';
import { Dialog } from '../components/Dialog';
import { StepList } from '../components/StepList';
import { Spinner } from '../components/ui';
import { explorerBlock } from '../lib/format';

type Phase = 'preparing' | 'confirm' | 'running' | 'result' | 'error';

interface Runner {
  busy: boolean;
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
  signing: 'Waiting for approval',
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
  const last = useRef<{ prepare: () => Promise<Prepared>; onDone?: (r: ActionResult) => void }>();
  const submitting = useRef(false);
  const preparation = useRef(0);

  const close = useCallback(() => { preparation.current++; setPhase(null); setPrepared(undefined); setResult(undefined); setError(undefined); }, []);

  const actPrepared = useCallback(async (prepare: () => Promise<Prepared>, opts?: { onDone?: (r: ActionResult) => void }) => {
    if (!backend) return;
    if (!passport) { setPassportOpen(true); return; }
    last.current = { prepare, onDone: opts?.onDone };
    const request = ++preparation.current;
    setPhase('preparing'); setError(undefined); setResult(undefined);
    try {
      const next = await prepare();
      if (request !== preparation.current) return;
      setPrepared(next);
      setPhase('confirm');
    } catch (e) {
      if (request !== preparation.current) return;
      setError({ message: (e as Error).message, fix: e instanceof UserError ? e.fix : undefined });
      setPhase('error');
    }
  }, [backend, passport]);

  const act = useCallback((intent: Intent, opts?: { onDone?: (r: ActionResult) => void }) => {
    if (!backend || !passport) { setPassportOpen(true); return; }
    return actPrepared(() => backend.prepare(intent, passport), opts);
  }, [backend, passport, actPrepared]);

  const run = async () => {
    if (!prepared || submitting.current) return;
    submitting.current = true;
    setPhase('running'); setStage('signing'); setDetail(undefined);
    let r: ActionResult;
    try { r = await prepared.run((s, d) => { setStage(s); setDetail(d); }); }
    catch (e) { r = { ok: false, error: (e as Error).message || 'The transaction could not be completed.' }; }
    submitting.current = false;
    setResult(r);
    setPhase(r.ok ? 'result' : 'error');
    if (!r.ok) setError({ message: r.error ?? 'The transaction failed.' });
    else { refresh(); void reloadBalances(); last.current?.onDone?.(r); }
  };

  // Esc closes unless a transaction is in flight
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase && phase !== 'running') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, close]);

  return (
    <Ctx.Provider value={{ busy: phase !== null, act, actPrepared, openPassport: () => setPassportOpen(true), passportOpen, closePassport: () => setPassportOpen(false) }}>
      {children}
      {phase && (
        <Dialog onClose={close} labelledBy="sheet-title" closeDisabled={phase === 'running'} focusKey={phase} className="transaction-dialog">
            {phase === 'preparing' && <div className="sheet-center"><h2 id="sheet-title">Preparing your review</h2><Spinner /><p>Checking your balances and the listing…</p></div>}

            {(phase === 'confirm' || phase === 'running') && prepared && (
              <>
                <h2 id="sheet-title">{prepared.title}</h2>
                <p className="sheet-sub">
                  {prepared.steps.some(s => s.lane === 'storage') ? 'Documents are stored first, then the listing is created in an atomic batch. The separate transactions each require a signature.' : 'Review the transaction. Your wallet will ask you to approve it.'}
                </p>
                <details className="transaction-details"><summary>See what happens in this transaction ({prepared.steps.length} {prepared.steps.length === 1 ? 'step' : 'steps'})</summary><StepList steps={prepared.steps} state={phase === 'running' ? 'running' : 'idle'} /></details>
                {prepared.cost && <p className="sheet-cost">{prepared.cost}</p>}
                <div className="sheet-actions">
                  {phase === 'confirm' ? (
                    <>
                      <button className="btn ghost" onClick={close}>Cancel</button>
                      <button className="btn primary" onClick={run}>Confirm</button>
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
                <details className="transaction-details"><summary>View completed steps</summary><StepList steps={prepared.steps} state="done" /></details>
                <ul className="tx-links">
                  {(result.txs ?? (result.txHash ? [{ label: 'Transaction', hash: result.txHash, block: result.blockNumber }] : [])).map((t) => (
                    <li key={t.hash}>
                      <span>{t.label}</span>
                      <a href={explorerBlock(t.block)} target="_blank" rel="noreferrer"><code>{t.hash.slice(0, 18)}…</code> view block</a>
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
                <h2 id="sheet-title">{error.fix === 'faucet' ? 'You need a few tokens first' : 'Transaction could not be confirmed'}</h2>
                <p className="sheet-error">{error.message}</p>
                <div className="sheet-actions">
                  <button className="btn ghost" onClick={close}>Close</button>
                  {error.fix === 'faucet' && <button className="btn primary" onClick={() => { close(); nav('/faucet'); }}>Check faucet availability</button>}
                </div>
              </>
            )}
        </Dialog>
      )}
    </Ctx.Provider>
  );
}
