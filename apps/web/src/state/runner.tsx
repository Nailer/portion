import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from './app';
import { usePassport } from './passport';
import { api, UserError, type ActionResult, type Intent, type Prepared, type StageName } from '../lib/backend';
import { Dialog } from '../components/Dialog';
import { TransactionSheet, TransactionTray, type SheetPhase } from '../components/TransactionSheet';
import { actionOutcome, connectReason } from '../lib/action-outcome';
import { rememberReceipt, readReceipts } from '../lib/receipt-journal';

interface Runner {
  busy: boolean;
  /** Runs an intent. Without a connected account it asks to connect, then continues to the same review. */
  act(intent: Intent, opts?: { onDone?: (r: ActionResult) => void }): void;
  /** Same confirm → run → result flow for actions that are not Portion intents (pools, teleport). */
  actPrepared(prepare: () => Promise<Prepared>, opts?: { onDone?: (r: ActionResult) => void }): void;
  openPassport(reason?: unknown): void;
  passportOpen: boolean;
  /** Why connection is being asked for, when an action prompted it. */
  passportReason?: string;
  /** `connected` keeps the waiting action; a plain close abandons it. */
  closePassport(opts?: { connected?: boolean }): void;
}
const Ctx = createContext<Runner>(null as any);
export const useRunner = () => useContext(Ctx);

export function RunnerProvider({ children }: { children: ReactNode }) {
  const { backend, refresh } = useApp();
  // Sandbox actions are simulated: they never enter the real receipt journal or link to the Portaldot explorer.
  const simulated = backend?.mode === 'sandbox';
  const { passport, reloadBalances } = usePassport();
  const nav = useNavigate();
  const [phase, setPhase] = useState<SheetPhase | null>(null);
  const [hidden, setHidden] = useState(false);
  const [prepared, setPrepared] = useState<Prepared>();
  const [stage, setStage] = useState<StageName>('preparing');
  const [reached, setReached] = useState<StageName[]>([]);
  const [stepLabel, setStepLabel] = useState<string>();
  const [result, setResult] = useState<ActionResult>();
  const [error, setError] = useState<{ message: string; fix?: 'faucet' }>();
  const [passportOpen, setPassportOpen] = useState(false);
  const [passportReason, setPassportReason] = useState<string>();
  const [currentIntent, setCurrentIntent] = useState<Intent>();
  const last = useRef<{ prepare: () => Promise<Prepared>; onDone?: (r: ActionResult) => void }>();
  const awaitingConnection = useRef<{ intent: Intent; opts?: { onDone?: (r: ActionResult) => void } }>();
  const submitting = useRef(false);
  const preparation = useRef(0);
  const currentIdentity = useRef({ passport, backend });
  currentIdentity.current = { passport, backend };
  const reviewedIdentity = useRef({ passport, backend });
  const [publishing, setPublishing] = useState(false);

  const close = useCallback(() => { preparation.current++; setPhase(null); setHidden(false); setPrepared(undefined); setResult(undefined); setError(undefined); setCurrentIntent(undefined); }, []);

  const actPrepared = useCallback(async (prepare: () => Promise<Prepared>, opts?: { onDone?: (r: ActionResult) => void }) => {
    if (submitting.current) { setHidden(false); return; }
    if (!backend) return;
    if (!passport) { setPassportReason(undefined); setPassportOpen(true); return; }
    last.current = { prepare, onDone: opts?.onDone };
    reviewedIdentity.current = { passport, backend };
    const request = ++preparation.current;
    setHidden(false); setPhase('preparing'); setPrepared(undefined); setError(undefined); setResult(undefined);
    try {
      const next = await prepare();
      if (request !== preparation.current) return;
      if (!simulated && readReceipts(localStorage).filter(row => row.status === 'unconfirmed').length >= 190) throw new Error('Reconcile your unresolved receipts before preparing another action.');
      if (!simulated && !next.recoveryKey && readReceipts(localStorage).some(row => row.owner === passport.address && row.title === next.title && row.status === 'unconfirmed')) {
        throw new Error('A previous attempt has an unknown outcome. Open the receipt centre and reconcile it before preparing this action again.');
      }
      setPrepared(next);
      setPhase('confirm');
    } catch (e) {
      if (request !== preparation.current) return;
      setError({ message: (e as Error).message, fix: e instanceof UserError ? e.fix : undefined });
      setPhase('error');
    }
  }, [backend, passport, simulated]);

  const act = useCallback((intent: Intent, opts?: { onDone?: (r: ActionResult) => void }) => {
    if (!backend) return;
    if (!passport) { awaitingConnection.current = { intent, opts }; setPassportReason(connectReason(intent)); setPassportOpen(true); return; }
    setCurrentIntent(intent);
    return actPrepared(() => backend.prepare(intent, passport), opts);
  }, [backend, passport, actPrepared]);

  // Connecting returns the person to the action they asked for: its review, never an automatic approval.
  useEffect(() => {
    if (!passport || !awaitingConnection.current) return;
    const waiting = awaitingConnection.current;
    awaitingConnection.current = undefined;
    void act(waiting.intent, waiting.opts);
  }, [passport, act]);

  useEffect(() => {
    if ((phase === 'preparing' || phase === 'confirm') &&
      (reviewedIdentity.current.passport !== passport || reviewedIdentity.current.backend !== backend)) {
      preparation.current++;
      setPrepared(undefined);
      setError({ message: 'Your account or network changed. Start a new review before approving.' });
      setPhase('error');
    }
  }, [passport, backend, phase]);

  const run = async () => {
    if (!prepared || submitting.current) return;
    if (reviewedIdentity.current.passport !== currentIdentity.current.passport || reviewedIdentity.current.backend !== currentIdentity.current.backend) {
      setError({ message: 'Your account or network changed. Start a new review before approving.' }); setPhase('error'); return;
    }
    submitting.current = true;
    setPhase('running'); setStage('signing'); setReached([]); setStepLabel(undefined);
    let r: ActionResult;
    // Only stages the network actually reported are ever marked. A new document or batch step starts its own track.
    try { r = await prepared.run((s, d) => {
      setStage(s);
      if (s === 'preparing') { setReached([]); setStepLabel(d); }
      else setReached(seen => seen.includes(s) ? seen : [...seen, s]);
    }); }
    catch (e) { r = { ok: false, error: (e as Error).message || 'The transaction could not be completed.' }; }
    submitting.current = false;
    try { if (!r.receiptId && !simulated) rememberReceipt(localStorage, reviewedIdentity.current.passport!.address, prepared.title, r); }
    catch { r.warning = [r.warning, 'Local receipt history could not be saved. Copy your hashes before closing.'].filter(Boolean).join(' '); }
    setResult(r);
    setPhase(r.ok ? 'result' : 'error');
    if (!r.ok) setError({ message: r.error ?? 'The transaction failed.' });
    else { refresh(); void reloadBalances(); last.current?.onDone?.(r); }
  };

  const dismiss = () => { if (phase === 'running') setHidden(true); else close(); };
  const go = (to: string) => { close(); nav(to); };
  const publish = async () => {
    if (!result) return;
    setPublishing(true);
    try { await api('/api/receipts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: result.blockNumber, txHash: result.txHash }) }); setResult({ ...result, warning: undefined }); refresh(); }
    catch { /* Preserve the receipt and warning for an explicit later retry. */ }
    finally { setPublishing(false); }
  };
  const finished = phase === 'result' || phase === 'error';
  const escrow = backend?.deployment?.contractVersion === 'core-v2';
  const persona = backend?.sandbox?.personas.find(p => p.passport === passport);

  return (
    <Ctx.Provider value={{ busy: phase !== null && !(hidden && finished), act, actPrepared,
      openPassport: reason => { awaitingConnection.current = undefined; setPassportReason(typeof reason === 'string' ? reason : undefined); setPassportOpen(true); },
      passportOpen, passportReason,
      closePassport: opts => { if (!opts?.connected) awaitingConnection.current = undefined; setPassportOpen(false); setPassportReason(undefined); } }}>
      {children}
      {phase && !hidden && (
        <Dialog onClose={dismiss} labelledBy="sheet-title" focusKey={phase} className="transaction-dialog">
          <TransactionSheet phase={phase} prepared={prepared} stage={stage} reached={reached} stepLabel={stepLabel} result={result} error={error} simulated={simulated} publishing={publishing}
            account={passport ? { label: persona?.label ?? '', address: passport.address } : undefined}
            outcome={actionOutcome(currentIntent, result?.listingId, escrow)}
            onConfirm={run} onDismiss={dismiss} onNavigate={go} onPublish={publish}
            onRetry={last.current && !result?.unconfirmed ? () => { const again = last.current!; void actPrepared(again.prepare, { onDone: again.onDone }); } : undefined}/>
        </Dialog>
      )}
      {phase && hidden && <TransactionTray title={prepared?.title ?? 'Transaction'} phase={phase} stage={stage} simulated={simulated} kind={phase === 'result' ? 'ok' : phase === 'error' ? 'problem' : undefined} onOpen={() => setHidden(false)} onDismiss={close}/>}
    </Ctx.Provider>
  );
}
