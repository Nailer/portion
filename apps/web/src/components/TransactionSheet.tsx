import type { ActionResult, Prepared, StageName } from '../lib/backend';
import { describeFailure, type ActionOutcome } from '../lib/action-outcome';
import { explorerBlock, pot, short } from '../lib/format';
import { Icon } from './Icon';
import { StepList } from './StepList';
import { CopyButton, Spinner } from './ui';

export type SheetPhase = 'preparing' | 'confirm' | 'running' | 'result' | 'error';

const STAGES: { key: StageName; label: string }[] = [
  { key: 'signing', label: 'Waiting for wallet approval' },
  { key: 'broadcast', label: 'Submitted to the network' },
  { key: 'inBlock', label: 'Included in a block, awaiting finality' },
  { key: 'done', label: 'Finalized' },
];
export const statusLine = (stage: StageName, simulated: boolean) => simulated ? 'Running on the simulated contract in this browser'
  : stage === 'preparing' ? 'Preparing' : stage === 'done' ? 'This step is finalized' : stage === 'failed' ? 'Failed' : STAGES.find(s => s.key === stage)?.label ?? 'Preparing';

function Progress({ stage, reached, stepLabel, simulated }: { stage: StageName; reached: StageName[]; stepLabel?: string; simulated: boolean }) {
  return <div className="tx-progress">
    <div className="tx-now" role="status" aria-live="polite"><Spinner/><div><b>{statusLine(stage, simulated)}</b>{stepLabel && <span>{stepLabel}</span>}{stage === 'signing' && !simulated && <span>Check your wallet. You can hide this window; the request stays open.</span>}</div></div>
    {!simulated && <ol className="tx-stages" aria-label="Transaction progress">{STAGES.map(s => <li key={s.key} data-state={s.key === stage ? 'current' : reached.includes(s.key) ? 'done' : 'waiting'}>{s.label}</li>)}</ol>}
  </div>;
}

function Receipt({ result, simulated }: { result: ActionResult; simulated: boolean }) {
  const txs = result.txs ?? (result.txHash ? [{ label: 'Transaction', hash: result.txHash, block: result.blockNumber }] : []);
  if (!txs.length) return null;
  return <details className="transaction-details"><summary>{simulated ? 'Simulated record' : 'Receipt details'} ({txs.length})</summary>
    <ul className="tx-receipts">{txs.map(t => <li key={t.hash}>
      <span>{t.label}{t.block ? ` · ${simulated ? 'sandbox ' : ''}block ${t.block.toLocaleString()}` : ''}</span>
      <code>{t.hash}</code>
      <span className="tx-receipt-actions"><CopyButton text={t.hash}/>{t.block && !simulated && <a href={explorerBlock(t.block)} target="_blank" rel="noreferrer">View block</a>}</span>
    </li>)}</ul>
  </details>;
}

export interface SheetProps {
  phase: SheetPhase;
  prepared?: Prepared;
  stage: StageName;
  reached: StageName[];
  stepLabel?: string;
  result?: ActionResult;
  error?: { message: string; fix?: 'faucet' };
  simulated: boolean;
  account?: { label: string; address: string };
  outcome: ActionOutcome;
  publishing: boolean;
  onConfirm(): void;
  onDismiss(): void;
  onRetry?(): void;
  onNavigate(to: string): void;
  onPublish(): void;
}

/** Title, plain status, what it concerns, progress or result, then receipts and the next step, always in that order. */
export function TransactionSheet(p: SheetProps) {
  const { phase, prepared, result, error, simulated } = p;
  const closeLabel = phase === 'running' ? 'Hide this window. The transaction continues.' : 'Close';
  const close = <button className="dialog-close" aria-label={closeLabel} title={closeLabel} onClick={p.onDismiss}><Icon name="close"/></button>;
  if (phase === 'preparing') return <>{close}<h2 id="sheet-title">Preparing your review</h2><div className="tx-now" role="status"><Spinner/><div><b>Checking your balances and the listing</b><span>Nothing has been sent.</span></div></div></>;
  if ((phase === 'confirm' || phase === 'running') && prepared) return <>
    {close}
    <h2 id="sheet-title">{prepared.title}</h2>
    {phase === 'confirm' && <p className="sheet-sub" role="status">{simulated ? 'Simulation: confirming runs this on the Core v2 contract in your browser. No wallet, no Portaldot, no real money.' : !prepared.steps.length ? 'This checks or publishes an already finalized record. No new wallet signature is requested.' : prepared.steps.some(s => s.lane === 'storage') ? 'Documents are stored first, then the listing is created in one atomic batch. Each transaction asks for its own wallet approval.' : 'Review this, then approve it in your wallet. Nothing is sent until you do.'}</p>}
    {prepared.cost && <p className="sheet-cost">{prepared.cost}</p>}
    {p.account && <dl className="tx-account"><dt>{simulated ? 'Acting as' : 'From'}</dt><dd>{p.account.label ? <b>{p.account.label}</b> : null} <code>{short(p.account.address, 8, 6)}</code></dd>{prepared.nativeReview && <><dt>Network fee</dt><dd>About {pot(prepared.nativeReview.estimatedFee, 6)}, plus any storage deposits your wallet shows</dd></>}</dl>}
    {phase === 'running' && <Progress stage={p.stage} reached={p.reached} stepLabel={p.stepLabel} simulated={simulated}/>}
    <details className="transaction-details"><summary>What happens in this transaction ({prepared.steps.length} {prepared.steps.length === 1 ? 'step' : 'steps'})</summary><StepList steps={prepared.steps} state={phase === 'running' ? 'running' : 'idle'}/>{prepared.nativeReview && <div className="notice"><p>Reviewed fee threshold: {pot(prepared.nativeReview.estimateThreshold, 6)}. Storage deposits and refunds are not included; inspect them in your wallet. A deposit limit is not a fee already spent.</p><small>{prepared.nativeReview.source}. Observed {new Date(prepared.nativeReview.observedAt).toLocaleTimeString()}; reference finalized block {prepared.nativeReview.referenceBlock}. Valid for two minutes. A higher estimate requires a new review, and the network may change fees before inclusion.</small></div>}</details>
    <div className="sheet-actions">
      {phase === 'confirm' ? <><button className="btn ghost" onClick={p.onDismiss}>Cancel</button><button className="btn primary" onClick={p.onConfirm}>{simulated ? 'Run in the sandbox' : !prepared.steps.length ? 'Continue' : 'Approve in wallet'}</button></>
        : <button className="btn ghost" onClick={p.onDismiss}>Hide and keep browsing</button>}
    </div>
  </>;
  if (phase === 'result' && prepared && result) return <>
    {close}
    <h2 id="sheet-title">{prepared.title}</h2>
    <p className={`tx-verdict ${simulated ? 'simulated' : 'ok'}`} role="status"><Icon name="shield" size={18}/><span>{simulated ? 'Done in the sandbox only. Nothing happened on Portaldot.' : `Finalized${result.blockNumber ? ` in block ${result.blockNumber.toLocaleString()}` : ''}`}</span></p>
    {p.outcome.changed && <div className="tx-changed"><small>What changed</small><p>{p.outcome.changed}</p></div>}
    {result.warning && <div className="notice" role="status"><p>{result.warning}</p><button className="btn ghost sm" disabled={p.publishing || !result.blockNumber} onClick={p.onPublish}>{p.publishing ? 'Publishing…' : 'Retry receipt publication'}</button></div>}
    <Receipt result={result} simulated={simulated}/>
    <details className="transaction-details"><summary>Completed steps</summary><StepList steps={prepared.steps} state="done"/></details>
    <div className="sheet-actions">
      <button className="btn ghost" onClick={p.onDismiss}>Close</button>
      {!simulated && <button className="btn ghost" onClick={() => p.onNavigate('/receipts')}>View the receipt</button>}
      {[...p.outcome.next].reverse().map((link, i, all) => <button key={link.to} className={`btn ${i === all.length - 1 ? 'primary' : 'ghost'}`} onClick={() => p.onNavigate(link.to)}>{link.label}</button>)}
    </div>
  </>;
  if (phase === 'error' && error) {
    const copy = describeFailure({ message: error.message, fix: error.fix, attempted: !!result, unconfirmed: result?.unconfirmed, blockNumber: result?.blockNumber, earlierSteps: !!result?.txs?.length }, simulated);
    return <>
      {close}
      <h2 id="sheet-title">{prepared?.title ?? copy.title}</h2>
      <p className={`tx-verdict ${copy.kind}`} role="alert"><Icon name="shield" size={18}/><span>{prepared && <b>{copy.title}. </b>}{copy.happened}</span></p>
      {error.message && <p className="sheet-error">{error.message}</p>}
      <p className="tx-next"><b>What to do next:</b> {copy.next}</p>
      {result && <Receipt result={result} simulated={simulated}/>}
      <div className="sheet-actions">
        <button className="btn ghost" onClick={p.onDismiss}>Close</button>
        {copy.kind === 'unknown' && !simulated ? <button className="btn primary" onClick={() => p.onNavigate('/receipts')}>Check in the receipt centre</button> : <>
          {copy.kind === 'failed' && !simulated && <button className="btn ghost" onClick={() => p.onNavigate('/receipts')}>View the receipt</button>}
          {copy.kind === 'funds' && !simulated && <button className="btn ghost" onClick={() => p.onNavigate('/faucet')}>Check test tokens</button>}
          {p.onRetry && <button className="btn primary" onClick={p.onRetry}>Review again</button>}
        </>}
      </div>
    </>;
  }
  return null;
}

/** Stays on screen while a hidden transaction runs and after it ends, until the person dismisses it. Never the only record. */
export function TransactionTray({ title, phase, stage, simulated, kind, onOpen, onDismiss }: { title: string; phase: SheetPhase; stage: StageName; simulated: boolean; kind?: 'ok' | 'problem'; onOpen(): void; onDismiss(): void }) {
  const finished = phase === 'result' || phase === 'error';
  return <aside className={`tx-tray ${kind ?? ''}`} aria-label="Transaction status">
    <div role="status" aria-live="polite"><b>{title}</b><span>{phase === 'running' ? statusLine(stage, simulated) : phase === 'result' ? (simulated ? 'Done in the sandbox only' : 'Finalized') : phase === 'error' ? 'Needs your attention' : 'Preparing'}</span></div>
    {!finished && <Spinner/>}
    <button className="btn ghost sm" onClick={onOpen}>{finished ? 'See result' : 'Open'}</button>
    {finished && <button className="dialog-close" aria-label="Dismiss this status" onClick={onDismiss}><Icon name="close" size={16}/></button>}
  </aside>;
}

