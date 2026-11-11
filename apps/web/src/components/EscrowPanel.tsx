import { useState } from 'react';
import { ASSET_CHECK_VALIDITY, contentHash, type EscrowView, type ListingView } from '@portion/sdk';
import { usd, span } from '../lib/format';
import type { EscrowAction, Intent } from '../lib/backend';
import { releaseBlock } from '../lib/escrow-rules';

const HASH = /^0x[0-9a-f]{64}$/i;
const PHASE_COPY: Record<EscrowView['phase'], { title: string; body: string }> = {
  Pending: { title: 'Waiting for independent review', body: 'No one can buy until the named reviewer records that it has checked the asset evidence.' },
  Funding: { title: 'Raising: payments are held by the contract', body: 'Nothing reaches the operator yet. If the target is missed, every buyer can take their full payment back.' },
  Active: { title: 'Funded: money is released in approved tranches', body: 'Each tranche needs evidence, the reviewer’s approval and one period in which large holders can challenge it. After the first, the reviewer must also have checked the operator’s revenue, and every release needs the reviewer to have confirmed the asset in the last 90 days.' },
  Refunding: { title: 'Refunds open', body: 'Money the operator never received is returned to buyers in proportion to what they paid. Money already released cannot be recovered.' },
};

/** Whether `now` may settle, release or clear a proposal. Mirrors the contract's timing rules exactly. */
export function escrowTiming(e: EscrowView, forSale: number, cadence: number, now: number) {
  const p = e.proposal;
  const expiresAt = p ? p.proposedAt + 3 * cadence : 0;
  const blockedBy = releaseBlock(e, now);
  return {
    canFinalize: e.phase === 'Funding' && (now > e.deadline || forSale === 0),
    releaseAt: p && p.approvedAt ? p.approvedAt + cadence : null,
    canRelease: !!p && !p.challenged && p.approvedAt > 0 && now >= p.approvedAt + cadence && now <= expiresAt && !blockedBy,
    blockedBy,
    canLapse: !!p && (p.challenged || now > expiresAt),
    expiresAt,
  };
}

function EvidenceInput({ id, value, onChange, sample }: { id: string; value: string; onChange: (v: string) => void; sample?: boolean }) {
  return <div className="field" style={{ marginBottom: 8 }}>
    <label htmlFor={id}>Evidence hash</label>
    <input id={id} value={value} placeholder="0x… (64 hex characters)" onChange={ev => onChange(ev.target.value.trim())} />
    <label className="hint" htmlFor={`${id}-file`}>Or choose the evidence file to hash it in your browser (the file is not uploaded):</label>
    <input id={`${id}-file`} type="file" onChange={async ev => { const f = ev.target.files?.[0]; if (f) onChange(contentHash(new Uint8Array(await f.arrayBuffer()))); }} />
    {sample && <button type="button" className="link-btn" onClick={() => onChange(contentHash(new TextEncoder().encode(`Sandbox sample evidence for ${id}`)))}>Sandbox: use a sample evidence file</button>}
  </div>;
}

export function EscrowPanel({ l, me, now, act, refundable, stake, sample = false }: {
  l: ListingView & { escrow: EscrowView }; me: string | null; now: number; act: (intent: Intent) => void; refundable: bigint; stake: number;
  /** Sandbox only: offers a ready-made evidence hash so a demo needs no file. */
  sample?: boolean;
}) {
  const e = l.escrow;
  const [evidence, setEvidence] = useState('');
  const t = escrowTiming(e, l.vault.forSale, l.cadence, now);
  const run = (fn: EscrowAction, withEvidence = false) => act({ kind: 'escrow', fn, id: l.id, ...(withEvidence ? { evidence } : {}) });
  const isReviewer = !!me && me === e.reviewer, isOperator = !!me && me === l.operator.toLowerCase();
  const canChallenge = stake * 10_000 >= l.vault.sold * 1_000 && stake > 0;
  const copy = PHASE_COPY[e.phase];
  const target = e.minSold.toLocaleString();

  return <section className="block escrow" aria-labelledby="escrow-h">
    <h2 id="escrow-h">{copy.title}</h2>
    <p>{copy.body}</p>
    <div className="facts">
      <div className="fact"><small>Funding target</small><b>{target} of {(l.vault.sold + l.vault.forSale).toLocaleString()} shares{e.activated ? ' · met' : ''}</b></div>
      <div className="fact"><small>{e.phase === 'Funding' ? 'Deadline' : 'Deadline was'}</small><b>{new Date(e.deadline * 1000).toLocaleDateString()}{e.phase === 'Funding' && now < e.deadline ? ` · ${span(e.deadline - now)} left` : ''}</b></div>
      <div className="fact"><small>Paid in by buyers</small><b>{usd(e.raised, 6)}</b></div>
      <div className="fact"><small>Released to the operator</small><b>{usd(e.released, 6)}</b></div>
      <div className="fact"><small>Still held by the contract</small><b>{usd(e.escrowed, 6)}</b></div>
      <div className="fact"><small>Independent reviewer</small><b><code title={e.reviewer}>{e.reviewer.slice(0, 8)}…{e.reviewer.slice(-4)}</code></b></div>
      {e.phase !== 'Pending' && <div className="fact"><small>Asset last confirmed by the reviewer</small><b>{e.assetCheckedAt ? `${new Date(e.assetCheckedAt * 1000).toLocaleDateString()} · ${now <= e.assetCheckedAt + ASSET_CHECK_VALIDITY ? `valid ${span(e.assetCheckedAt + ASSET_CHECK_VALIDITY - now)} more` : 'out of date'}` : 'Never'}</b></div>}
      {e.activated && <div className="fact"><small>Operator revenue checked by the reviewer</small><b>{usd(e.verifiedRevenue, 6)} of {usd(e.reportedRevenue, 6)}</b></div>}
    </div>

    <h3>Release schedule</h3>
    <ol className="tranches">
      {e.tranches.map((bps, i) => <li key={i} data-state={i < e.nextTranche ? 'released' : i === e.nextTranche && e.proposal ? 'open' : 'waiting'}>
        <span>Tranche {i + 1}: {bps / 100}%</span>
        <b>{i < e.nextTranche ? 'Released' : i === e.nextTranche && e.proposal ? (e.proposal.challenged ? 'Challenged' : e.proposal.approvedAt ? 'Approved, in challenge window' : 'Awaiting reviewer') : e.phase === 'Refunding' ? 'Not released · refundable' : 'Not requested'}</b>
      </li>)}
    </ol>
    {e.lapses > 0 && e.phase === 'Active' && <p className="notice">{e.lapses} tranche request failed. One more failure opens refunds of the unreleased money.</p>}
    {e.proposal && <p className="note">
      Evidence <code>{e.proposal.evidence.slice(0, 12)}…</code>. {t.releaseAt ? (now < t.releaseAt ? `Release possible in ${span(t.releaseAt - now)}.` : 'The challenge window has passed.') : 'The reviewer has not approved it.'} The request expires {now < t.expiresAt ? `in ${span(t.expiresAt - now)}` : 'now'}.
    </p>}
    {e.phase === 'Active' && e.proposal && t.blockedBy && <p className="notice">
      {t.blockedBy === 'asset' ? 'No tranche can be released until the reviewer confirms the asset again: the last confirmation is more than 90 days old.'
        : 'This tranche cannot be released until the reviewer verifies the operator’s reported revenue against evidence. If it is never verified, the request lapses, and two failures return the unreleased money to buyers.'}
    </p>}

    <div className="escrow-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
      {refundable > 0n && <button className="btn primary sm" onClick={() => run('refund')}>Take back {usd(refundable, 6)}</button>}
      {t.canFinalize && <button className="btn ghost sm" onClick={() => run('finalize')}>Settle the raise</button>}
      {t.canRelease && <button className="btn ghost sm" onClick={() => run('release')}>Release the approved tranche</button>}
      {/* Sandbox only: lets a viewer see the contract itself refuse a release that is not yet allowed. */}
      {sample && e.proposal && !e.proposal.challenged && !t.canRelease && <button className="btn ghost sm" onClick={() => run('release')}>Sandbox: try to release it now</button>}
      {t.canLapse && <button className="btn ghost sm" onClick={() => run('lapse')}>Clear the failed request</button>}
      {e.proposal && !e.proposal.challenged && canChallenge && <button className="btn ghost sm" onClick={() => run('challenge')}>Challenge this tranche</button>}
      {isReviewer && e.proposal && !e.proposal.approvedAt && !e.proposal.challenged && <button className="btn primary sm" onClick={() => run('approve')}>Approve the tranche</button>}
    </div>
    {e.proposal && !canChallenge && stake > 0 && <p className="hint">Challenging needs at least 10% of sold shares staked in one account.</p>}

    {isReviewer && e.phase === 'Pending' && <div style={{ marginTop: 16 }}>
      <h3>Record your review</h3>
      <EvidenceInput id="attest-ev" value={evidence} onChange={setEvidence} sample={sample} />
      <button className="btn primary sm" disabled={!HASH.test(evidence)} onClick={() => run('attest', true)}>Attest and open the sale</button>
      <p className="hint">Your address and this hash are recorded permanently. Attest only to what you checked.</p>
    </div>}
    {isReviewer && (e.phase === 'Funding' || e.phase === 'Active') && <div style={{ marginTop: 16 }}>
      <h3>Ongoing checks</h3>
      <EvidenceInput id="check-ev" value={evidence} onChange={setEvidence} sample={sample} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn ghost sm" disabled={!HASH.test(evidence)} onClick={() => run('confirmAsset', true)}>Confirm the asset</button>
        {e.activated && e.reportedRevenue > e.verifiedRevenue && <button className="btn primary sm" disabled={!HASH.test(evidence)} onClick={() => act({ kind: 'escrow', fn: 'verifyRevenue', id: l.id, evidence, upTo: e.reportedRevenue })}>Verify revenue up to {usd(e.reportedRevenue, 6)}</button>}
      </div>
      <p className="hint">Confirm the asset after a site visit or inspection. Verify revenue only once meter readings, invoices or bank records show the asset really earned what the operator deposited. Your address and the evidence hash are recorded permanently.</p>
    </div>}
    {isOperator && e.phase === 'Active' && !e.proposal && e.nextTranche < e.tranches.length && <div style={{ marginTop: 16 }}>
      <h3>Request tranche {e.nextTranche + 1}</h3>
      <EvidenceInput id="propose-ev" value={evidence} onChange={setEvidence} sample={sample} />
      <button className="btn primary sm" disabled={!HASH.test(evidence)} onClick={() => run('propose', true)}>Request the tranche</button>
      <p className="hint">Show what the money was or will be spent on. A defaulted listing receives no further tranches.</p>
    </div>}
    {isOperator && (e.phase === 'Pending' || e.phase === 'Funding' || e.phase === 'Active') && <p className="note" style={{ marginTop: 12 }}>
      <button className="link-btn" onClick={() => run('cancel')}>Cancel the raise</button> returns every unreleased payment to buyers.
    </p>}
  </section>;
}
