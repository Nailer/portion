import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { useAsync } from '../components/ui';

const DAY = 86_400, WEEK = 7 * DAY;

type Step = { who?: string; title: string; body: string; to?: string; skip?: number };
interface Tour { id: string; title: string; lede: string; steps: Step[] }

// Listing 100002 starts open for funding; 100001 starts funded and earning. See src/sandbox/backend.ts.
const TOURS: Tour[] = [
  { id: 'fund', title: '1. Fund an asset and follow the money', lede: 'Harbour Cold Room is open for funding. Buy it out, settle the raise, release the first tranche of escrow and pay revenue to holders.', steps: [
    { who: 'buyerA', title: 'Buy 250 shares', body: 'Choose 250 on the share wheel and buy. Your payment goes into escrow, not to the operator, and your shares are staked.', to: '/listing/100002?shares=250' },
    { who: 'buyerB', title: 'Buy the last 150 shares', body: 'The offer is now sold out. The funding target was 200 shares.', to: '/listing/100002?shares=150' },
    { who: 'buyerB', title: 'Settle the raise', body: 'In the “Where your money is” panel, choose “Settle the raise”. Anyone can do this. The target was met, so the listing becomes Active and the payment clock starts.', to: '/listing/100002' },
    { who: 'operator', title: 'Request the first tranche', body: 'Attach any file as evidence (for example an invoice). Only its hash is recorded. The operator asks for 40% of the escrow.', to: '/listing/100002' },
    { who: 'reviewer', title: 'Approve the tranche', body: 'Only the reviewer named at creation can approve. This starts a one-week window in which holders can challenge.', to: '/listing/100002' },
    { title: 'Wait out the challenge window', body: 'Time in the sandbox only moves when you skip it.', skip: WEEK + DAY },
    { who: 'operator', title: 'Pay in revenue, then release', body: 'Pay in at least the stated minimum so the operator stays on time, then choose “Release the tranche”. The operator receives 40% of the escrow, less the 1% fee.', to: '/listing/100002' },
    { who: 'buyerA', title: 'Claim your revenue', body: 'Buyer A holds 250 of 400 staked shares, so receives 62.5% of the deposit after the 0.5% fee.', to: '/portfolio' },
  ] },
  { id: 'protect', title: '2. See what protects holders', lede: 'Riverside Solar Canopy is already earning. Challenge a tranche, then let the operator go silent and recover the money still in escrow.', steps: [
    { who: 'buyerA', title: 'Claim what is already owed', body: 'Two deposits were paid before you arrived. Claim them from your portfolio.', to: '/portfolio' },
    { who: 'operator', title: 'Request the second tranche', body: 'Attach any file as evidence.', to: '/listing/100001' },
    { who: 'buyerA', title: 'Challenge it', body: 'Holders with at least 10% of sold shares staked can challenge during the window. Two failed tranches return the unreleased money to buyers.', to: '/listing/100001' },
    { title: 'Let the operator miss two payments', body: 'Skip three weeks. The listing turns Late, then Defaulted. The operator keeps one more week to cure before a slash opens.', skip: 3 * WEEK },
    { title: 'Wait one more week', body: 'The cure period ends.', skip: WEEK + DAY },
    { who: 'buyerB', title: 'Slash the bond', body: 'Anyone can. The caller gets 1% of the bond, staked holders get the rest, and because escrow is still held, refunds open.', to: '/listing/100001' },
    { who: 'buyerB', title: 'Take back your share of the escrow', body: 'Buyer B paid a third of the raise, so receives a third of the money the operator never received. Released money cannot be recovered.', to: '/listing/100001' },
  ] },
  { id: 'create', title: '3. Create an asset and miss the target', lede: 'Publish a new fictional offer, have it reviewed, and watch a failed raise refund every buyer in full.', steps: [
    { who: 'operator', title: 'Prepare and publish an offer', body: 'Fill in a fictional asset. Use “Fill in the sandbox Reviewer” on the funding step. A photo is optional here; the sandbox uses a placeholder.', to: '/create' },
    { who: 'reviewer', title: 'Record the review', body: 'Open the new listing from the overview. No one could buy until now. Attach any file as review evidence.', to: '/' },
    { who: 'buyerA', title: 'Buy a few shares', body: 'Buy fewer than the funding target.', to: '/' },
    { title: 'Let the deadline pass', body: 'Skip past the funding deadline you chose.', skip: 31 * DAY },
    { who: 'buyerA', title: 'Settle, then refund', body: 'Settle the raise: the target was missed, so refunds open. Take your money back in full; the shares return to the operator.', to: '/' },
  ] },
];

export function Sandbox() {
  const { sandbox, backend, enterSandbox, exitSandbox, resetSandbox, refresh, tick } = useApp();
  const { passport, selectAccount } = usePassport();
  const { act } = useRunner();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const controls = backend?.sandbox;
  const current = controls?.personas.find(p => p.passport === passport);
  const { data: pausedUntil } = useAsync(async () => controls ? controls.pausedUntil() : 0, [controls, tick]);
  const label = (key?: string) => controls?.personas.find(p => p.key === key)?.label ?? key;
  const go = (step: Step) => { if (step.who) selectAccount(step.who); refresh(); if (step.to) nav(step.to); };
  const skip = async (seconds: number) => { if (!controls) return; setBusy(true); try { await controls.skip(seconds); refresh(); } finally { setBusy(false); } };
  const now = backend?.now() ?? 0;
  const paused = !!pausedUntil && pausedUntil > now;

  return (
    <div className="sandbox-page">
      <section className="sandbox-hero">
        <span className="eyebrow">SANDBOX · SIMULATED IN YOUR BROWSER</span>
        <h1 className="page-title">Try every part of Portion, without a wallet or real money.</h1>
        <p className="page-lede">The sandbox runs the Core v2 contract inside this browser tab. You can act as the operator, the reviewer, two buyers and the guardian, and move time forward to see payments, defaults and refunds play out.</p>
        {!sandbox ? <div className="sandbox-actions"><button className="btn primary" onClick={enterSandbox}>Start the sandbox</button><Link className="btn ghost" to="/">Stay on the live testnet</Link></div>
          : <div className="sandbox-actions"><Link className="btn primary" to="/">Open the overview</Link><button className="btn ghost" onClick={() => { if (confirm('Start the sandbox again from the opening state? Everything you did here will be cleared.')) resetSandbox(); }}>Reset to the opening state</button><button className="btn ghost" onClick={exitSandbox}>Exit the sandbox</button></div>}
      </section>

      <section className="sandbox-truth" aria-label="What is real and what is simulated">
        <div><h2>Real</h2><ul>
          <li>The <b>Core v2 contract code</b>, byte for byte. The sandbox checks it against the reviewed artifact before starting.</li>
          <li>Every rule it enforces: escrow, funding target and deadline, reviewer approval, challenges, default, slash, refunds and the guardian pause.</li>
          <li>The same pages, dialogs and checks as the live app.</li>
        </ul></div>
        <div><h2>Simulated</h2><ul>
          <li>The chain: an EVM running in this tab. Nothing reaches Portaldot.</li>
          <li>Money: pretend pUSD and share tokens, at the addresses Portaldot gives native assets.</li>
          <li>Accounts: five labelled roles with no keys. Time moves only when you skip it.</li>
          <li>The deed NFT and its fractionalization, which are native Portaldot steps.</li>
        </ul></div>
        <div><h2>Not in the sandbox</h2><ul>
          <li>Wallet signing, native fees and storage deposits.</li>
          <li>Share markets, which use Portaldot’s asset-conversion pallet.</li>
          <li>Document storage on Portaldot. Documents stay in this browser.</li>
        </ul><p className="note">Core v2 is not yet deployed to Portaldot or audited. For the real testnet record, see the <Link to="/evidence">evidence page</Link> outside the sandbox.</p></div>
      </section>

      {sandbox && controls && <section className="sandbox-roles" aria-label="Roles">
        <h2>Roles</h2>
        <div className="sandbox-role-grid">{controls.personas.map(p => <button key={p.key} className={`sandbox-role-card${current?.key === p.key ? ' active' : ''}`} aria-pressed={current?.key === p.key} onClick={() => { selectAccount(p.key); refresh(); }}><b>{p.label}</b><span>{p.role}</span><code>{p.passport.h160.slice(0, 10)}…</code></button>)}</div>
      </section>}

      <section className="sandbox-tours">
        <h2>Guided demo</h2>
        <p className="note">Each step says who acts and where. “Act as …” switches role and opens the right page; then use the page’s own buttons, exactly as on the live app.</p>
        {TOURS.map(tour => <article key={tour.id} className="sandbox-tour">
          <h3>{tour.title}</h3><p>{tour.lede}</p>
          <ol>{tour.steps.map((step, i) => <li key={i}>
            <div><span className={`sandbox-who${step.who ? '' : ' time'}`}>{step.who ? label(step.who) : 'Time'}</span><b>{step.title}</b><p>{step.body}</p></div>
            {sandbox && controls ? step.skip ? <button className="btn ghost sm" disabled={busy} onClick={() => void skip(step.skip!)}>Skip {step.skip >= WEEK ? `${Math.round(step.skip / WEEK)} week${Math.round(step.skip / WEEK) === 1 ? '' : 's'}` : `${Math.round(step.skip / DAY)} days`}</button>
              : <button className="btn ghost sm" onClick={() => go(step)}>Act as {label(step.who)}</button> : null}
          </li>)}</ol>
        </article>)}
        <article className="sandbox-tour">
          <h3>4. Pause new money</h3>
          <p>The guardian, fixed when the contract is deployed, can stop new money for at most seven days and must then wait seven more before pausing again. Claims, refunds, deposits and challenges never stop.</p>
          {sandbox && controls ? <div className="sandbox-actions">
            <span className="note" role="status">{paused ? `Paused until ${new Date(pausedUntil! * 1000).toLocaleString()}.` : 'Not paused.'}</span>
            {current?.key !== 'guardian' ? <button className="btn ghost sm" onClick={() => { selectAccount('guardian'); refresh(); }}>Act as Guardian</button>
              : <button className="btn primary sm" onClick={() => act({ kind: 'guardian', fn: paused ? 'unpause' : 'pause' })}>{paused ? 'Lift the pause' : 'Pause new money for seven days'}</button>}
            <span className="note">Then try to buy as a buyer (refused) and claim revenue (still works).</span>
          </div> : null}
        </article>
        {!sandbox && <div className="sandbox-actions"><button className="btn primary" onClick={enterSandbox}>Start the sandbox</button></div>}
      </section>
    </div>
  );
}
