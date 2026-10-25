import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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

interface Photo { bytes: Uint8Array; mime: string; url: string }

export function Create() {
  const { backend, status, reconnect } = useApp();
  const { passport } = usePassport();
  const { act, openPassport } = useRunner();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState(0);
  const [terms, setTerms] = useState('');
  const [totalShares, setTotalShares] = useState(0);
  const [percentForSale, setPercentForSale] = useState(0);
  const [price, setPrice] = useState('');
  const [cadence, setCadence] = useState<number>(CADENCES[2].seconds);
  const [minPer, setMinPer] = useState('');
  const [bond, setBond] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoErr, setPhotoErr] = useState<string>();
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
      setName(d.name); setSummary(d.summary); setCategory(d.category); setTerms(d.terms); setTotalShares(d.totalShares);
      setPercentForSale(d.percentForSale); setPrice(d.price); setCadence(d.cadence); setMinPer(d.minPer); setBond(d.bond);
      setPhoto(null); setStep(0); setTouched(false); setDraftMessage('Draft restored. Upload the asset photo and review all terms and current costs before publishing.');
    } catch (error) { setDraftMessage(`Draft could not be restored: ${(error as Error).message}`); }
  };
  const { data: rules, error: rulesError } = useAsyncRules(backend);

  const forSale = Math.round((totalShares * percentForSale) / 100);
  const raise = forSale * Number(price || 0);
  const minBond = (raise * (rules?.minBondBps ?? 0)) / 10_000;
  useEffect(() => { setBond((b) => (b === '' || Number(b) < minBond ? (Math.ceil(minBond * 100) / 100).toString() : b)); }, [minBond]);

  const safeUnits = (v: string) => { try { return parseUnits(v, 6); } catch { return 0n; } };
  const netRaise = safeUnits(price) * BigInt(forSale) * BigInt(10000 - (rules?.saleFeeBps ?? 0)) / 10000n;
  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url); }, [photo?.url]);

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Give it a name people will recognise.';
  else if (new TextEncoder().encode(name.trim()).length > 64) errors.name = 'Keep the name under 64 bytes (shorter for accented or non-Latin text).';
  if (new TextEncoder().encode(summary.trim()).length > 280) errors.summary = 'Keep the summary under 280 bytes.';
  if (!terms.trim()) errors.terms = 'Explain how you earn and when you will pay.';
  if (safeUnits(price) <= 0n) errors.price = 'Set a positive price with at most six decimal places.';
  if (safeUnits(minPer) <= 0n) errors.minPer = 'Set a positive minimum with at most six decimal places.';
  if (cadence < (rules?.minCadence ?? 60)) errors.cadence = 'That period is too short.';
  if (safeUnits(bond) <= 0n || Number(bond) < minBond) errors.bond = `The bond must be at least ${usd(BigInt(Math.ceil(minBond * 1e6)))} (${(rules?.minBondBps ?? 0) / 100}% of the raise).`;
  if (forSale < 1 || forSale > totalShares) errors.shares = 'Choose at least one share to offer for funding.';
  if (!Number.isSafeInteger(totalShares) || totalShares < 10 || totalShares > 1000000) errors.shares = 'Use a whole number between 10 and 1,000,000.';
  if (!photo) errors.photo = 'Upload a real asset photo.';
  const valid = !!rules && Object.keys(errors).length === 0;
  const groups = [['name','summary','terms'],['shares','price'],['cadence','minPer','bond']];
  const next = () => { setTouched(true); if (!(groups[step] ?? []).some(k => errors[k])) {setStep(Math.min(3,step+1));setTouched(false);} };

  const onPhoto = async (f?: File | null) => {
    setPhotoErr(undefined);
    if (!f) return setPhoto(null);
    try {
      const c = await compressImage(f);
      setPhoto({ bytes: c.bytes, mime: c.mime, url: URL.createObjectURL(new Blob([c.bytes as BlobPart], { type: c.mime })) });
    } catch (e) { setPhotoErr((e as Error).message); }
  };

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    if (!passport) return openPassport();
    act({ kind: 'tokenize', form: {
      name: name.trim(), summary: summary.trim(), category, totalShares, sharesForSale: forSale, pricePusd: price,
      cadenceSeconds: cadence, minPerPeriodPusd: minPer, bondPusd: bond, terms: terms.trim(),
      image: photo ? { bytes: photo.bytes, mime: photo.mime } : null,
    } });
  };
  const show = (k: string) => (touched ? errors[k] : undefined);

  if (!rules) return <div className="market-empty"><h2>{rulesError || status === 'offline' ? 'Listing setup unavailable' : 'Checking listing rules…'}</h2><p>{rulesError || (status === 'offline' ? 'Reconnect to the testnet before entering funding terms.' : 'Reading the deployed contract before you enter funding terms.')}</p>{(rulesError || status === 'offline') && <button className="btn" onClick={reconnect}>Try again</button>}</div>;
  return (
    <div className="create">
      <Link className="crumb" to="/operator">← Your operator workspace</Link>
      <div className="eyebrow" style={{marginTop:28}}>CREATE AN ASSET LISTING</div>
      <h1>Put your next asset<br/><span>in motion.</span></h1>
      <p className="page-lede">Describe the business, choose your funding terms, and set a payment schedule. Review everything before publishing.</p>
      <details><summary>Check your wallet and service readiness</summary><Readiness/></details>
      <section className="workspace-info" aria-label="Unsigned listing draft"><div><b>Keep your progress</b><p>Save these business details on this browser. No photo, wallet credentials or transaction is saved or submitted. Anyone using this browser profile may read the draft.</p>{savedDraft && <small>Last saved {new Date(savedDraft).toLocaleString()}</small>}<p role="status">{draftMessage}</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn ghost sm" type="button" onClick={saveDraft}>Save draft</button><button className="btn ghost sm" type="button" disabled={!savedDraft} onClick={restoreDraft}>Restore draft</button><button className="btn ghost sm" type="button" onClick={() => { try { clearListingDraft(localStorage); setSavedDraft(null); setDraftMessage('Saved draft removed. The current form is unchanged.'); } catch { setDraftMessage('This browser could not remove the saved draft.'); } }}>Clear saved draft</button></div></section>
      <nav className="create-progress" aria-label="Listing creation steps">{['Your asset','Funding','Payments','Review'].map((label,i)=><button key={label} type="button" disabled={i>step} aria-current={step===i?'step':undefined} onClick={()=>{setStep(i);setTouched(false);}}><span>{i<step?'✓':String(i+1).padStart(2,'0')}</span>{label}</button>)}</nav>

      <div className="create-grid" style={{ marginTop: 32 }}>
        <form onSubmit={(e) => { e.preventDefault(); step < 3 ? next() : submit(); }} noValidate>
          <fieldset className="fieldset" hidden={step !== 0}>
            <legend>What is it?</legend>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Neighbourhood solar hub" />
              {show('name') && <p className="err">{show('name')}</p>}
            </div>
            <div className="field">
              <label htmlFor="summary">One-line summary</label>
              <input id="summary" type="text" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Phone charging for a busy bus stop, about 120 charges a day." />
              {show('summary') && <p className="err">{show('summary')}</p>}
            </div>
            <div className="field">
              <label htmlFor="cat">Category</label>
              <select id="cat" value={category} onChange={(e) => setCategory(Number(e.target.value))}>{CATEGORIES.map((c, i) => <option key={c} value={i}>{c}</option>)}</select>
            </div>
            <div className="field">
              <label>Photo</label>
              <div className="drop">
                {photo && <img src={photo.url} alt="Your uploaded asset" />}
                <input type="file" accept="image/*" aria-label="Upload a photo" onChange={(e) => onPhoto(e.target.files?.[0])} />
                <p className="hint">{photo ? `Compressed to ${(photo.bytes.length / 1024).toFixed(1)} KB so it fits in one on-chain document.` : 'Upload a real photo of the asset. A photo is required.'}</p>
                {photoErr && <p className="err">{photoErr}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="terms">How you earn and how you will pay</label>
              <textarea id="terms" rows={5} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Customers pay per charge. I report takings every week and pay in 70% of the net." />
              {show('terms') && <p className="err">{show('terms')}</p>}
              <p className="hint">This text is stored on-chain and hashed into the deed, so it cannot be quietly changed later.</p>
            </div>
          </fieldset>

          <fieldset className="fieldset" hidden={step !== 1}>
            <legend>How much do you want to sell?</legend>
            <div className="two">
              <div className="field">
                <label htmlFor="shares">Total shares</label>
                <input id="shares" type="number" min={10} max={1_000_000} value={totalShares} onChange={(e) => setTotalShares(Math.max(10, Math.min(1_000_000, Math.trunc(Number(e.target.value)) || 10)))} />
                <p className="hint">The native share supply is fixed after issuance.</p>{show('shares') && <p className="err">{show('shares')}</p>}
              </div>
              <div className="field">
                <label htmlFor="price">Price per share</label>
                <div className="input-affix"><input id="price" type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} /><span>pUSD</span></div>
                {show('price') && <p className="err">{show('price')}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="pct">Offer {percentForSale}% for sale ({forSale.toLocaleString()} shares). You keep {(totalShares - forSale).toLocaleString()}.</label>
              <input id="pct" type="range" min={5} max={100} step={5} value={percentForSale} onChange={(e) => setPercentForSale(Number(e.target.value))} />
              <p className="hint">If it all sells you raise {usd(BigInt(Math.round(raise * 1e6)), 0)}.</p>
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
                <div className="input-affix"><input id="min" type="number" min="0" step="any" value={minPer} onChange={(e) => setMinPer(e.target.value)} /><span>pUSD</span></div>
                {show('minPer') && <p className="err">{show('minPer')}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="bond">Bond you lock</label>
              <div className="input-affix"><input id="bond" type="number" min="0" step="any" value={bond} onChange={(e) => setBond(e.target.value)} /><span>pUSD</span></div>
              {show('bond') ? <p className="err">{show('bond')}</p> : <p className="hint">If you miss payments for two periods in a row, anyone can slash this and it goes to your share-holders. Minimum {usd(BigInt(Math.ceil(minBond * 1e6)))}.</p>}
            </div>
          </fieldset>

          {step === 3 && <section className="create-review"><span className="eyebrow">THE LAST LOOK</span><h2>Here’s what you’re publishing.</h2><dl><dt>Asset</dt><dd>{name}</dd><dt>Offered shares</dt><dd>{forSale.toLocaleString()} of {totalShares.toLocaleString()}</dd><dt>Price per share</dt><dd>{usd(safeUnits(price))}</dd><dt>Maximum raise before fees</dt><dd>{usd(safeUnits(price)*BigInt(forSale))}</dd><dt>Estimated proceeds if sold out</dt><dd>{usd(netRaise)}</dd><dt>Deposit schedule</dt><dd>{usd(safeUnits(minPer))} {cadenceLabel(cadence)}</dd><dt>Bond locked separately</dt><dd>{usd(safeUnits(bond))}</dd></dl><p className="notice">The bond uses your existing funds. Customer income is reported by you. Publishing does not verify physical equipment or establish funders’ legal rights. Define those rights in an enforceable agreement before accepting real money.</p><p className="terms">{terms}</p></section>}
          <div className="create-controls">
            {step>0 && <button className="btn ghost" type="button" onClick={()=>{setStep(step-1);setTouched(false);}}>← Back</button>}
            <button className="btn primary" type="submit">{step<3 ? 'Continue →' : passport ? 'Review and publish ↗' : 'Connect wallet to publish'}</button>
            {touched && !valid && <span className="err" role="alert" style={{ color: 'var(--tomato)' }}>Check the highlighted fields before continuing.</span>}
          </div>
        </form>

        <div className="sticky">
          <div className="preview-card">
            {photo ? <img className="cover" src={photo.url} alt="Your uploaded asset" /> : <div className="notice">Upload a real asset photo to preview it here.</div>}
            <div className="body">
              <h3>{name || 'Your listing'}</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>{summary || 'Your one-line summary appears here.'}</p>
              <div className="sum-line"><span>Price per share</span><b>{usd(safeUnits(price))}</b></div>
              <div className="sum-line"><span>Promise</span><b>{usd(safeUnits(minPer), 0)} {cadenceLabel(cadence)}</b></div>
              <div className="sum-line"><span>Offered shares</span><b>{forSale.toLocaleString()}</b></div><div className="sum-line"><span>Estimated proceeds after sale fee</span><b>{usd(netRaise)}</b></div><p className="hint">Preview only. Funding depends on purchases; revenue depends on the operator’s business.</p>
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
