import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from './app';
import { usePassport } from './passport';
import { api, UserError, type ActionResult, type Intent, type Prepared, type StageName } from '../lib/backend';
import { Dialog } from '../components/Dialog';
import { StepList } from '../components/StepList';
import { Spinner, CopyButton } from '../components/ui';
import { explorerBlock, pot } from '../lib/format';
import { rememberReceipt, readReceipts } from '../lib/receipt-journal';

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
  // Sandbox actions are simulated: they never enter the real receipt journal or link to the Portaldot explorer.
  const simulated = backend?.mode === 'sandbox';
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
  const currentIdentity = useRef({ passport, backend });
  currentIdentity.current = { passport, backend };
  const reviewedIdentity = useRef({ passport, backend });
  const [publishing, setPublishing] = useState(false);

  const close = useCallback(() => { preparation.current++; setPhase(null); setPrepared(undefined); setResult(undefined); setError(undefined); }, []);

  const actPrepared = useCallback(async (prepare: () => Promise<Prepared>, opts?: { onDone?: (r: ActionResult) => void }) => {
    if (submitting.current) return;
    if (!backend) return;
    if (!passport) { setPassportOpen(true); return; }
    last.current = { prepare, onDone: opts?.onDone };
    reviewedIdentity.current = { passport, backend };
    const request = ++preparation.current;
    setPhase('preparing'); setPrepared(undefined); setError(undefined); setResult(undefined);
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
    if (!backend || !passport) { setPassportOpen(true); return; }
    return actPrepared(() => backend.prepare(intent, passport), opts);
  }, [backend, passport, actPrepared]);

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
    setPhase('running'); setStage('signing'); setDetail(undefined);
    let r: ActionResult;
    try { r = await prepared.run((s, d) => { setStage(s); setDetail(d); }); }
    catch (e) { r = { ok: false, error: (e as Error).message || 'The transaction could not be completed.' }; }
    submitting.current = false;
    try { if (!r.receiptId && !simulated) rememberReceipt(localStorage, reviewedIdentity.current.passport!.address, prepared.title, r); }
    catch { r.warning = [r.warning, 'Local receipt history could not be saved. Copy your hashes before closing.'].filter(Boolean).join(' '); }
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
                  {simulated ? 'Sandbox: confirming runs this on the Core v2 contract simulated in your browser. No wallet, no Portaldot, no real money.' : !prepared.steps.length ? 'This checks or publishes an already finalized record. No new wallet signature is requested.' : prepared.steps.some(s => s.lane === 'storage') ? 'Accepted documents are reused. Missing documents are stored first, then the listing is created in an atomic batch. Separate transactions require separate signatures.' : 'Review the transaction. Your wallet will ask you to approve it.'}
                </p>
                <details className="transaction-details"><summary>See what happens in this transaction ({prepared.steps.length} {prepared.steps.length === 1 ? 'step' : 'steps'})</summary><StepList steps={prepared.steps} state={phase === 'running' ? 'running' : 'idle'} /></details>
                {prepared.cost && <p className="sheet-cost">{prepared.cost}</p>}
                {prepared.nativeReview && <div className="notice"><b>Estimated native execution fee: {pot(prepared.nativeReview.estimatedFee,6)}</b><p>Reviewed estimate threshold: {pot(prepared.nativeReview.estimateThreshold,6)}. Additional storage deposits and any refunds are not included in this estimate; inspect them in your wallet. A deposit limit is not a fee already spent.</p><small>{prepared.nativeReview.source}. Observed {new Date(prepared.nativeReview.observedAt).toLocaleTimeString()}; reference finalized block {prepared.nativeReview.referenceBlock}. Valid for two minutes. Fee estimates are checked before opening your wallet; a higher estimate requires a new review. The network may change fees before inclusion.</small></div>}
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
                <p className="sheet-sub">{prepared.title} went through{result.blockNumber ? ` in ${simulated ? 'sandbox ' : ''}block ${result.blockNumber.toLocaleString()}` : ''}.{simulated ? ' This happened only in the sandbox.' : ''}</p>
                {result.warning && <div className="notice" role="status"><p>{result.warning}</p><button className="btn ghost sm" disabled={publishing || !result.blockNumber} onClick={async () => { setPublishing(true); try { await api('/api/receipts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ block: result.blockNumber, txHash: result.txHash }) }); setResult({ ...result, warning: undefined }); refresh(); } catch { /* Preserve the receipt and warning for an explicit later retry. */ } finally { setPublishing(false); } }}>{publishing ? 'Publishing…' : 'Retry receipt publication'}</button></div>}
                <details className="transaction-details"><summary>View completed steps</summary><StepList steps={prepared.steps} state="done" /></details>
                <ul className="tx-links">
                  {(result.txs ?? (result.txHash ? [{ label: 'Transaction', hash: result.txHash, block: result.blockNumber }] : [])).map((t) => (
                    <li key={t.hash}>
                      <span>{t.label}</span>
                      {t.block && !simulated ? <a href={explorerBlock(t.block)} target="_blank" rel="noreferrer"><code>{t.hash.slice(0, 18)}…</code> view block</a> : <code>{t.hash}</code>}<CopyButton text={t.hash}/>
                    </li>
                  ))}
                </ul>
                <div className="sheet-actions">
                  {result.listingId !== undefined && <button className="btn primary" onClick={() => { close(); nav(`/listing/${result.listingId}`); }}>Open the listing</button>}
                  {!simulated && <button className="btn ghost" onClick={() => { close(); nav('/receipts'); }}>Open receipt centre</button>}
                  <button className={`btn ${result.listingId !== undefined ? 'ghost' : 'primary'}`} onClick={close}>Close</button>
                </div>
              </>
            )}

            {phase === 'error' && error && (
              <>
                <h2 id="sheet-title">{error.fix === 'faucet' ? (simulated ? 'This role needs more sandbox pUSD' : 'You need a few tokens first') : result?.unconfirmed ? 'Outcome unknown — check before retrying' : /reject|denied|cancelled|canceled/i.test(error.message) ? 'Wallet request declined' : result?.blockNumber ? 'Transaction failed in a finalized block' : !result ? 'Review unavailable' : 'Action could not be completed'}</h2>
                <p className="sheet-error">{error.message}</p>
                {result?.unconfirmed && <p className="notice">The outcome is unknown. Do not submit the action again until its transaction has been reconciled against finalized chain records.</p>}
                {result?.txHash && <p><code style={{overflowWrap:'anywhere'}}>{result.txHash}</code> <CopyButton text={result.txHash}/></p>}
                {!!result?.txs?.length && <div className="notice"><p>Earlier steps were finalized. Keep these receipts before retrying.</p>{result.txs.map(tx => <p key={tx.hash}><b>{tx.label}</b> · <code>{tx.hash.slice(0, 18)}…</code> <CopyButton text={tx.hash}/>{tx.block && <a href={explorerBlock(tx.block)} target="_blank" rel="noreferrer"> View block</a>}</p>)}</div>}
                <div className="sheet-actions">
                  <button className="btn ghost" onClick={close}>Close</button>
                  {!simulated && <button className="btn ghost" onClick={() => { close(); nav('/receipts'); }}>Open receipt centre</button>}
                  {error.fix === 'faucet' && !simulated && <button className="btn primary" onClick={() => { close(); nav('/faucet'); }}>Check faucet availability</button>}
                </div>
              </>
            )}
        </Dialog>
      )}
    </Ctx.Provider>
  );
}
