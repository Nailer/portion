import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CADENCES, CATEGORIES, parseUnits } from '@portion/sdk';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { StepList } from '../components/StepList';
import { compressImage } from '../lib/image';
import { tokenizeSteps } from '../lib/steps';
import { cadenceLabel, usd } from '../lib/format';
import { saveListingDraft, readListingDraft, clearListingDraft } from '../lib/listing-draft';
import { Readiness } from '../components/Readiness';
import { offeredShares, fundingAmounts, pusdInput } from '../lib/funding-preview';

interface Photo { bytes: Uint8Array; mime: string; url: string; width: number; height: number }

export function Create() {
  const { backend, status, reconnect } = useApp();
  const { passport } = usePassport();
  const { act, openPassport } = useRunner();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState(0);
  const [terms, setTerms] = useState('');
  const [sharesText, setSharesText] = useState('');
  const totalShares = Number(sharesText) || 0;
  const [percentForSale, setPercentForSale] = useState(50);
  const [price, setPrice] = useState('');
  const [cadence, setCadence] = useState<number>(CADENCES[2].seconds);
  const [minPer, setMinPer] = useState('');
  const [bond, setBond] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  // Core v2 funding controls. Not saved in the browser draft: they name other people's addresses.
  const v2 = (backend as { deployment?: { contractVersion?: string } } | undefined)?.deployment?.contractVersion === 'core-v2';
  const sandboxReviewer = backend?.sandbox?.personas.find(p => p.key === 'reviewer')?.passport.h160;
  const [reviewer, setReviewer] = useState('');
  const [recovery, setRecovery] = useState('');
  const [targetPct, setTargetPct] = useState(50);
  const [deadlineDays, setDeadlineDays] = useState(30);
  const [trancheCount, setTrancheCount] = useState(2);
  const [photoErr, setPhotoErr] = useState<string>();
  const [photoBusy,setPhotoBusy] = useState(false);
  const photoRequest = useRef(0);
  useEffect(()=>()=>{photoRequest.current++;},[]);
  const [touched, setTouched] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [savedDraft, setSavedDraft] = useState<number | null>(null);
  useEffect(() => {
    try { setSavedDraft(readListingDraft(localStorage)?.savedAt ?? null); }
    catch { setDraftMessage('Saved draft could not be read. You can clear it and start again.'); }
  }, []);
  const saveDraft = () => {
    try { setSavedDraft(saveListingDraft(localStorage, { name, summary, category, terms, totalShares, percentForSale, price, cadence, minPer, bond })); setDraftMessage('Draft saved on this browser. Your photo is not saved; upload it again when restoring.'); }
    catch (error) { setDraftMessage(`Draft was not saved: ${(error as Error).message}`); }
  };
  const restoreDraft = () => {
    try {
      const saved = readListingDraft(localStorage); if (!saved) { setDraftMessage('No saved draft found.'); return; }
      const d = saved.draft;
      setName(d.name); setSummary(d.summary); setCategory(d.category); setTerms(d.terms); setSharesText(d.totalShares ? String(d.totalShares) : '');
      setPercentForSale(d.percentForSale); setPrice(d.price); setCadence(d.cadence); setMinPer(d.minPer); setBond(d.bond);
      photoRequest.current++; setPhotoBusy(false); setPhoto(null); setStep(0); setTouched(false); setDraftMessage('Draft restored. Upload the asset photo and review all terms and current costs before publishing.');
    } catch (error) { setDraftMessage(`Draft could not be restored: ${(error as Error).message}`); }
  };
  const { data: rules, error: rulesError } = useAsyncRules(backend);

  const safeUnits = (v: string) => { try { return parseUnits(v, 6); } catch { return 0n; } };
  const forSale=offeredShares(totalShares,percentForSale);
  const funding=rules?fundingAmounts(price,forSale,rules.saleFeeBps,rules.minBondBps):null;
  const minBond=funding?.minimumBond ?? 0n;
  useEffect(()=>{setBond(value=>value==='' || safeUnits(value)<minBond?pusdInput(minBond):value);},[minBond]);
  const netRaise=funding?.netEstimate ?? null;
  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url); }, [photo?.url]);

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Give it a name people will recognise.';
  else if (new TextEncoder().encode(name.trim()).length > 64) errors.name = 'Keep the name under 64 bytes (shorter for accented or non-Latin text).';
  if (new TextEncoder().encode(summary.trim()).length > 280) errors.summary = 'Keep the summary under 280 bytes.';
  if (!terms.trim()) errors.terms = 'Explain how you earn and when you will pay.';
  if (safeUnits(price) <= 0n) errors.price = 'Set a positive price with at most six decimal places.';
  if (safeUnits(minPer) <= 0n) errors.minPer = 'Set a positive minimum with at most six decimal places.';
  if (cadence < (rules?.minCadence ?? 60)) errors.cadence = 'That period is too short.';
  if (safeUnits(bond) <= 0n || safeUnits(bond) < minBond) errors.bond = rules ? `The bond must be at least ${usd(minBond)} (${rules.minBondBps / 100}% of the raise).` : 'Enter a bond. The minimum is checked once the contract’s rules can be read.';
  if (forSale < 1 || forSale > totalShares) errors.shares = 'Choose at least one share to offer for funding.';
  if (!Number.isSafeInteger(totalShares) || totalShares < 10 || totalShares > 1000000) errors.shares = 'Enter a whole number between 10 and 1,000,000.';
  if (!photo && !backend?.sandbox) errors.photo = 'Upload a real asset photo.';
  const H160 = /^0x[0-9a-fA-F]{40}$/;
  const minSold = Math.max(1, Math.ceil(forSale * targetPct / 100));
  const tranches = Array.from({ length: trancheCount }, (_, i) => i < trancheCount - 1 ? Math.floor(10_000 / trancheCount) : 10_000 - Math.floor(10_000 / trancheCount) * (trancheCount - 1));
  if (v2) {
    if (!H160.test(reviewer)) errors.reviewer = 'Enter the reviewer’s contract address (0x followed by 40 hex characters).';
    else if (passport && reviewer.toLowerCase() === passport.h160.toLowerCase()) errors.reviewer = 'The reviewer must be someone other than you.';
    if (recovery && (!H160.test(recovery) || recovery.toLowerCase() === reviewer.toLowerCase() || (passport && recovery.toLowerCase() === passport.h160.toLowerCase()))) errors.recovery = 'Use a different valid address from yours and the reviewer’s, or leave it empty.';
    if (!Number.isInteger(targetPct) || targetPct < 1 || targetPct > 100) errors.target = 'Choose a target between 1% and 100% of the offered shares.';
    if (!Number.isInteger(deadlineDays) || deadlineDays < 1 || deadlineDays > 180) errors.deadline = 'Choose a deadline between 1 and 180 days.';
    if (!Number.isInteger(trancheCount) || trancheCount < 1 || trancheCount > 12) errors.tranches = 'Choose between 1 and 12 tranches.';
    // Mirrors the contract: the stated minimum must add up to at least 2% of the offered value per year.
    if (!errors.minPer && safeUnits(minPer) * 365n * 86_400n * 10_000n < BigInt(cadence) * BigInt(forSale) * safeUnits(price) * 200n) errors.minPer = 'The minimum deposit must add up to at least 2% of the offered value each year.';
  }
  const valid = !!rules && !photoBusy && Object.keys(errors).length === 0;
  const groups = [['name','summary','terms','photo'],['shares','price'],['cadence','minPer','bond','reviewer','recovery','target','deadline','tranches']];
  const firstProblem = groups.findIndex(group => group.some(k => errors[k]));
  const next = () => { setTouched(true); if (!(groups[step] ?? []).some(k => errors[k])) {setStep(Math.min(3,step+1));setTouched(false);} };

  const onPhoto = async (file?: File | null) => {
    const request=++photoRequest.current; setPhotoErr(undefined); setPhoto(null);
    if(!file) {setPhotoBusy(false);return;}
    setPhotoBusy(true);
    try {
      const image=await compressImage(file);
      if(request!==photoRequest.current) return;
      setPhoto({...image,url:URL.createObjectURL(new Blob([image.bytes as BlobPart],{type:image.mime}))});
    } catch(error) {if(request===photoRequest.current) setPhotoErr((error as Error).message);}
    finally {if(request===photoRequest.current) setPhotoBusy(false);}
  };

  const submit = () => {
    setTouched(true);
    if (!valid) { if (firstProblem >= 0 && firstProblem < 3) setStep(firstProblem); return; }
    act({ kind: 'tokenize', form: {
      name: name.trim(), summary: summary.trim(), category, totalShares, sharesForSale: forSale, pricePusd: price,
      cadenceSeconds: cadence, minPerPeriodPusd: minPer, bondPusd: bond, terms: terms.trim(),
      image: photo ? { bytes: photo.bytes, mime: photo.mime } : null,
      ...(v2 ? { controls: { reviewer, recovery: recovery || undefined, minSold, deadlineDays, tranches } } : {}),
    } });
  };
  const show = (k: string) => (touched ? errors[k] : undefined);

  const sandbox = !!backend?.sandbox;
  const stepLabels = ['Your asset', 'Funding', 'Payments', 'Review'];
  return (
    <div className="create">
      <Link className="crumb" to="/operator">← Manage offers</Link>
      <div className="eyebrow" style={{marginTop:28}}>{sandbox ? 'SANDBOX · SIMULATED' : 'TEST NETWORK'}</div>
      <h1>Create an offer</h1>
      <p className="page-lede">Offer shares in an asset you run, and commit to paying revenue to whoever holds them. You can draft without a wallet.</p>
      <section className="create-before" aria-labelledby="before-h">
        <h2 id="before-h">Before you start</h2>
        <div>
          <div><b>You’ll need</b><ul><li>{sandbox ? 'A photo of the asset, if you have one' : 'A real photo of the asset'}</li><li>How it earns and how you’ll pay holders</li><li>Share count, price and a deposit schedule</li>{!!v2 && <li>The address of an independent reviewer</li>}</ul></div>
          <div><b>It will cost</b><ul>{sandbox ? <li>Nothing. Sandbox money is pretend.</li> : <><li>A bond of at least {(rules?.minBondBps ?? 500) / 100}% of the offer, in test pUSD</li><li>About 45 tPOT in fees and storage deposits, as measured on our last test on 24 October. Your review shows the current estimate.</li><li>Up to three wallet approvals</li></>}</ul></div>
          <div><b>After you publish</b><ul><li>{v2 ? 'Your reviewer must attest before anyone can buy' : 'Your offer can be bought straight away'}</li><li>Terms and photo are public and can’t be changed</li><li>Missing two payment periods puts you in default, and anyone can then slash the bond</li></ul></div>
        </div>
      </section>
      {status !== 'ready' && <p className="notice" role="status">{status === 'connecting' ? 'Still connecting to the test network. You can keep drafting; fees and the minimum bond are checked before you can publish.' : <>The test network isn’t answering. You can keep drafting, and save your draft below, but you can’t publish until it does. <button type="button" className="link-btn" onClick={reconnect}>Retry connection</button></>}</p>}
      {status === 'ready' && !rules && <p className="notice" role="status">{rulesError ?? 'Reading the contract’s fees and minimum bond…'}</p>}
      <details className="create-readiness"><summary>Check my wallet and service readiness</summary><Readiness/></details>
      <section className="workspace-info" aria-label="Unsigned listing draft"><div><b>Keep your progress</b><p>Save these business details on this browser. No photo, wallet credentials or transaction is saved or submitted. Anyone using this browser profile may read the draft.</p>{savedDraft && <small>Last saved {new Date(savedDraft).toLocaleString()}</small>}<p role="status">{draftMessage}</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn ghost sm" type="button" onClick={saveDraft}>Save draft</button><button className="btn ghost sm" type="button" disabled={!savedDraft} onClick={restoreDraft}>Restore draft</button><button className="btn ghost sm" type="button" onClick={() => { try { clearListingDraft(localStorage); setSavedDraft(null); setDraftMessage('Saved draft removed. The current form is unchanged.'); } catch { setDraftMessage('This browser could not remove the saved draft.'); } }}>Clear saved draft</button></div></section>
      <nav className="create-progress" aria-label="Listing creation steps">{stepLabels.map((label,i)=><button key={label} type="button" disabled={i>step} aria-current={step===i?'step':undefined} onClick={()=>{setStep(i);setTouched(false);}}><span>{i<step?'✓':String(i+1).padStart(2,'0')}</span>{label}</button>)}</nav>

      <div className="create-grid" style={{ marginTop: 32 }}>
        <form onSubmit={(e) => { e.preventDefault(); step < 3 ? next() : submit(); }} noValidate>
          <fieldset className="fieldset" hidden={step !== 0}>
            <legend>What is it?</legend>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" type="text" aria-invalid={!!show('name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="For example: Neighbourhood solar hub" />
              {show('name') && <p className="err">{show('name')}</p>}
            </div>
            <div className="field">
              <label htmlFor="summary">One-line summary</label>
              <input id="summary" type="text" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="For example: Phone charging at a bus stop, about 120 charges a day" />
              {show('summary') && <p className="err">{show('summary')}</p>}
            </div>
            <div className="field">
              <label htmlFor="cat">Category</label>
              <select id="cat" value={category} onChange={(e) => setCategory(Number(e.target.value))}>{CATEGORIES.map((c, i) => <option key={c} value={i}>{c}</option>)}</select>
            </div>
            <div className="field">
              <label>Photo{sandbox ? ' (optional in the sandbox)' : ''}</label>
              <div className="drop">
                {photo && <img src={photo.url} alt="Your uploaded asset" />}
                <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload a photo" onChange={(e) => { const file=e.target.files?.[0]; e.currentTarget.value=''; void onPhoto(file); }} />
                <p className="hint">{photoBusy ? 'Preparing your photo…' : photo ? `${photo.width} × ${photo.height} pixels · ${(photo.bytes.length / 1024).toFixed(1)} KB. Check the actual preview before publishing.` : sandbox ? 'Skip this to use a placeholder image.' : 'Upload a real photo of the asset. A photo is required.'}</p>
                {photoErr && <p className="err">{photoErr}</p>}
                {!photoErr && show('photo') && <p className="err">{show('photo')}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="terms">How you earn and how you will pay</label>
              <textarea id="terms" rows={5} aria-invalid={!!show('terms')} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="For example: Customers pay per charge. I report takings weekly and pay in 70% of the net." />
              {show('terms') && <p className="err">{show('terms')}</p>}
              <p className="hint">The final image and terms are public and hashed into the deed. Do not include identity documents, bank details or private customer data. A photo alone is not independent proof of equipment ownership.</p>
            </div>
          </fieldset>

          <fieldset className="fieldset" hidden={step !== 1}>
            <legend>How much do you want to sell?</legend>
            <div className="two">
              <div className="field">
                <label htmlFor="shares">Total shares</label>
                <input id="shares" type="number" inputMode="numeric" min={10} max={1_000_000} placeholder="For example: 1000" aria-invalid={!!show('shares')} value={sharesText} onChange={(e) => setSharesText(e.target.value)} />
                <p className="hint">The native share supply is fixed after issuance.</p>{show('shares') && <p className="err">{show('shares')}</p>}
              </div>
              <div className="field">
                <label htmlFor="price">Price per share</label>
                <div className="input-affix"><input id="price" type="number" min="0" step="any" placeholder="For example: 5" aria-invalid={!!show('price')} value={price} onChange={(e) => setPrice(e.target.value)} /><span>pUSD</span></div>
                {show('price') && <p className="err">{show('price')}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="pct">Offer {percentForSale}% for sale{totalShares ? ` (${forSale.toLocaleString()} shares). You keep ${(totalShares - forSale).toLocaleString()}.` : '.'}</label>
              <input id="pct" type="range" min={5} max={100} step={5} value={percentForSale} onChange={(e) => setPercentForSale(Number(e.target.value))} />
              <p className="hint">{funding ? `If it all sells, the gross raise is ${usd(funding.gross)}.` : 'The raise is worked out once the contract’s rules can be read.'}</p>
            </div>
          </fieldset>

          <fieldset className="fieldset" hidden={step !== 2}>
            <legend>What are you promising?</legend>
            <div className="two">
              <div className="field">
                <label htmlFor="cad">Pay in</label>
                <select id="cad" value={cadence} onChange={(e) => setCadence(Number(e.target.value))}>{CADENCES.map((c) => <option key={c.seconds} value={c.seconds}>{c.label}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="min">At least</label>
                <div className="input-affix"><input id="min" type="number" min="0" step="any" placeholder="For example: 25" aria-invalid={!!show('minPer')} value={minPer} onChange={(e) => setMinPer(e.target.value)} /><span>pUSD</span></div>
                {show('minPer') && <p className="err">{show('minPer')}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="bond">Bond you lock</label>
              <div className="input-affix"><input id="bond" type="number" min="0" step="any" aria-invalid={!!show('bond')} value={bond} onChange={(e) => setBond(e.target.value)} /><span>pUSD</span></div>
              {show('bond') ? <p className="err">{show('bond')}</p> : <p className="hint">{v2
                ? <>Three periods after your last qualifying deposit, someone can slash the bond. The caller takes the disclosed tip; the rest goes to holders, never to Portion, and any money still in escrow becomes refundable. {rules ? `Minimum ${usd(minBond)}. ` : ''}This is not principal insurance.</>
                : <>After two missed periods, someone can slash the bond. The caller takes the disclosed tip; the rest goes to current stakers, or treasury if none remain. {rules ? `Minimum ${usd(minBond)}. ` : ''}This is not principal insurance.</>}</p>}
            </div>
            {v2 && <>
              <div className="field">
                <label htmlFor="reviewer">Independent reviewer’s address</label>
                <input id="reviewer" value={reviewer} placeholder="0x…" onChange={e => setReviewer(e.target.value.trim())} />
                {sandboxReviewer && reviewer.toLowerCase() !== sandboxReviewer && <button type="button" className="link-btn" onClick={() => setReviewer(sandboxReviewer)}>Fill in the sandbox Reviewer</button>}
                {show('reviewer') ? <p className="err">{show('reviewer')}</p> : <p className="hint">No one can buy until this person records a review on-chain. They also approve each release of escrow. Choose someone who will check the asset and is not you.</p>}
              </div>
              <div className="field">
                <label htmlFor="recovery">Recovery address (optional)</label>
                <input id="recovery" value={recovery} placeholder="0x…" onChange={e => setRecovery(e.target.value.trim())} />
                {show('recovery') ? <p className="err">{show('recovery')}</p> : <p className="hint">Can hand the listing to a new operator key, with one period’s notice, if yours is lost. Leave empty for none.</p>}
              </div>
              <div className="two">
                <div className="field">
                  <label htmlFor="target">Funding target (% of offered shares)</label>
                  <input id="target" type="number" min={1} max={100} value={targetPct} onChange={e => setTargetPct(Math.floor(Number(e.target.value)))} />
                  {show('target') ? <p className="err">{show('target')}</p> : <p className="hint">{minSold.toLocaleString()} shares. Missing it refunds every buyer in full.</p>}
                </div>
                <div className="field">
                  <label htmlFor="deadline">Days to reach it</label>
                  <input id="deadline" type="number" min={1} max={180} value={deadlineDays} onChange={e => setDeadlineDays(Math.floor(Number(e.target.value)))} />
                  {show('deadline') && <p className="err">{show('deadline')}</p>}
                </div>
              </div>
              <div className="field">
                <label htmlFor="tranches">Release the money in</label>
                <select id="tranches" value={trancheCount} onChange={e => setTrancheCount(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} equal tranche{i ? 's' : ''}</option>)}</select>
                {show('tranches') ? <p className="err">{show('tranches')}</p> : <p className="hint">Each release needs evidence, the reviewer’s approval and one period in which holders can challenge it. The 1% Portion fee is taken from each release.</p>}
              </div>
            </>}
          </fieldset>

          {step === 3 && <section className="create-review"><h2>Review what you’re publishing</h2><dl><dt>Publishing from</dt><dd>{passport ? <code>{passport.address}</code> : 'The wallet you connect next'}</dd><dt>Asset</dt><dd>{name}</dd><dt>Offered shares</dt><dd>{forSale.toLocaleString()} of {totalShares.toLocaleString()}</dd><dt>Price per share</dt><dd>{usd(safeUnits(price))}</dd><dt>Maximum raise before fees</dt><dd>{usd(safeUnits(price)*BigInt(forSale))}</dd><dt>Estimated proceeds if sold out</dt><dd>{usd(netRaise)}</dd><dt>Deposit schedule</dt><dd>{usd(safeUnits(minPer))} {cadenceLabel(cadence)}</dd><dt>Bond locked separately</dt><dd>{usd(safeUnits(bond))}</dd>{v2 && <><dt>Independent reviewer</dt><dd><code>{reviewer}</code></dd><dt>Funding target</dt><dd>{minSold.toLocaleString()} shares within {deadlineDays} days, or full refunds</dd><dt>Escrow release</dt><dd>{tranches.map(t => `${t / 100}%`).join(' · ')}</dd></>}</dl><p className="notice"><b>When you publish:</b> the terms and photo become public and can’t be changed, and your bond is locked in the contract. The bond uses your existing funds. Customer income is reported by you. Publishing does not verify physical equipment or establish holders’ legal rights; define those in an enforceable agreement before accepting real money.</p><p className="terms">{terms}</p></section>}
          <div className="create-controls">
            {step>0 && <button className="btn ghost" type="button" onClick={()=>{setStep(step-1);setTouched(false);}}>← Back to {stepLabels[step-1].toLowerCase()}</button>}
            <button className="btn primary" type="submit">{step<3 ? `Next: ${stepLabels[step+1].toLowerCase()} →` : passport ? 'Review and publish' : 'Connect wallet to publish'}</button>
            {touched && firstProblem >= 0 && <span className="err" role="alert" style={{ color: 'var(--tomato)' }}>Fix the messages shown beside the fields.</span>}
            {touched && firstProblem < 0 && !valid && <span className="err" role="alert" style={{ color: 'var(--tomato)' }}>{photoBusy ? 'Your photo is still being prepared.' : 'Publishing needs the contract’s rules, which can’t be read right now. Your form is kept.'}</span>}
            {step===3 && !passport && <p className="hint">Connecting keeps this form. You’ll see a final review before approving anything.</p>}
          </div>
        </form>

        <div className="sticky">
          <div className="preview-card">
            {photo ? <img className="cover" src={photo.url} alt="Your uploaded asset" /> : <div className="notice">Your photo appears here.</div>}
            <div className="body">
              <h3>{name || 'Your asset’s name'}</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>{summary || 'Your one-line summary appears here.'}</p>
              <div className="sum-line"><span>Price per share</span><b>{usd(safeUnits(price))}</b></div>
              <div className="sum-line"><span>Stated minimum deposit</span><b>{usd(safeUnits(minPer),6)} {cadenceLabel(cadence)}</b></div>
              <div className="sum-line"><span>Offered shares</span><b>{forSale.toLocaleString()}</b></div><div className="sum-line"><span>Estimated proceeds after sale fee</span><b>{netRaise === null ? '—' : usd(netRaise)}</b></div><p className="hint">Preview only. Funding depends on purchases; revenue depends on the operator’s business.</p>
            </div>
          </div>
          <div className="hood">
            <details><summary>See the onchain steps</summary><h2>Under the hood</h2>
            <p>Tokenizing runs these calls. The final six calls form one atomic batch, so a failure anywhere leaves nothing half-done.</p>
            <StepList steps={tokenizeSteps(totalShares)} atomicFrom={2} /></details>
          </div>
        </div>
      </div>
    </div>
  );
}

function useAsyncRules(backend: ReturnType<typeof useApp>['backend']) {
  const [data, setData] = useState<Awaited<ReturnType<NonNullable<typeof backend>['rules']>>>();
  const [error, setError] = useState<string>();
  useEffect(() => { let active = true; setData(undefined); setError(undefined); backend?.rules().then(value => { if (active) setData(value); }).catch(() => { if (active) setError('Verified contract rules could not be loaded.'); }); return () => { active = false; }; }, [backend]);
  return { data, error };
}
