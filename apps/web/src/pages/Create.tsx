import { useEffect, useMemo, useState } from 'react';
import { CADENCES, CATEGORIES, generateCover } from '@portion/sdk';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { StepList } from '../components/StepList';
import { compressImage } from '../lib/image';
import { tokenizeSteps } from '../lib/steps';
import { cadenceLabel, usd } from '../lib/format';

interface Photo { bytes: Uint8Array; mime: string; url: string }

export function Create() {
  const { backend } = useApp();
  const { passport } = usePassport();
  const { act, openPassport } = useRunner();

  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState(0);
  const [terms, setTerms] = useState('');
  const [totalShares, setTotalShares] = useState(1000);
  const [percentForSale, setPercentForSale] = useState(60);
  const [price, setPrice] = useState('10');
  const [cadence, setCadence] = useState<number>(CADENCES[0].seconds);
  const [minPer, setMinPer] = useState('50');
  const [bond, setBond] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [photoErr, setPhotoErr] = useState<string>();
  const [touched, setTouched] = useState(false);
  const { data: rules } = useAsyncRules(backend);

  const forSale = Math.round((totalShares * percentForSale) / 100);
  const raise = forSale * Number(price || 0);
  const minBond = (raise * (rules?.minBondBps ?? 500)) / 10_000;
  useEffect(() => { setBond((b) => (b === '' || Number(b) < minBond ? (Math.ceil(minBond * 100) / 100).toString() : b)); }, [minBond]);

  const emblem = useMemo(() => 'data:image/svg+xml;utf8,' + encodeURIComponent(generateCover(name || 'New listing', category)), [name, category]);
  const apy = raise > 0 ? ((Number(minPer) * 0.995 * ((365 * 86_400) / cadence)) / (totalShares * Number(price))) : 0;

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Give it a name people will recognise.';
  else if (name.length > 64) errors.name = 'Keep the name under 64 characters.';
  if (summary.length > 280) errors.summary = 'Keep the summary under 280 characters.';
  if (!terms.trim()) errors.terms = 'Explain how you earn and when you will pay.';
  if (!(Number(price) > 0)) errors.price = 'Set a price per share.';
  if (!(Number(minPer) > 0)) errors.minPer = 'Promise a minimum payment per period.';
  if (cadence < (rules?.minCadence ?? 60)) errors.cadence = 'That period is too short.';
  if (Number(bond) < minBond) errors.bond = `The bond must be at least ${usd(BigInt(Math.ceil(minBond * 1e6)))} (${(rules?.minBondBps ?? 500) / 100}% of the raise).`;
  const valid = Object.keys(errors).length === 0;

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

  return (
    <div className="create">
      <h1>Tokenize something that earns</h1>
      <p className="page-lede">Describe it, set the terms, and publish. One signature mints the deed, splits it into shares, stores the paperwork on-chain and opens the sale.</p>

      <div className="create-grid" style={{ marginTop: 32 }}>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          <fieldset className="fieldset">
            <legend>What is it?</legend>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Yaba solar charging kiosk" />
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
                <img src={photo?.url ?? emblem} alt="Cover preview" />
                <input type="file" accept="image/*" aria-label="Upload a photo" onChange={(e) => onPhoto(e.target.files?.[0])} />
                <p className="hint">{photo ? `Compressed to ${(photo.bytes.length / 1024).toFixed(1)} KB so it fits in one on-chain document.` : 'No photo? Portion draws an emblem for you. A real photo builds more trust.'}</p>
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

          <fieldset className="fieldset">
            <legend>How much do you want to sell?</legend>
            <div className="two">
              <div className="field">
                <label htmlFor="shares">Total shares</label>
                <input id="shares" type="number" min={10} max={1_000_000} value={totalShares} onChange={(e) => setTotalShares(Math.max(10, Math.min(1_000_000, Number(e.target.value) || 10)))} />
                <p className="hint">Fixed forever once minted.</p>
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

          <fieldset className="fieldset">
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

          <div style={{ marginTop: 28, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" type="submit">{passport ? 'Review and tokenize' : 'Open a Passport to continue'}</button>
            {touched && !valid && <span className="err" style={{ color: 'var(--tomato)' }}>Fix the highlighted fields first.</span>}
          </div>
        </form>

        <div className="sticky">
          <div className="preview-card">
            <img className="cover" src={photo?.url ?? emblem} alt="" />
            <div className="body">
              <h3>{name || 'Your listing'}</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>{summary || 'Your one-line summary appears here.'}</p>
              <div className="sum-line"><span>Price per share</span><b>{usd(BigInt(Math.round(Number(price || 0) * 1e6)))}</b></div>
              <div className="sum-line"><span>Promise</span><b>{usd(BigInt(Math.round(Number(minPer || 0) * 1e6)), 0)} {cadenceLabel(cadence)}</b></div>
              <div className="sum-line"><span>Yield at that promise</span><b>{(apy * 100).toFixed(0)}% a year</b></div>
            </div>
          </div>
          <div className="hood">
            <h2>Under the hood</h2>
            <p>Tokenizing runs these calls. The last six form one atomic batch, so a failure anywhere leaves nothing half-done.</p>
            <StepList steps={tokenizeSteps(totalShares)} atomicFrom={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

function useAsyncRules(backend: ReturnType<typeof useApp>['backend']) {
  const [data, setData] = useState<Awaited<ReturnType<NonNullable<typeof backend>['rules']>>>();
  useEffect(() => { backend?.rules().then(setData).catch(() => undefined); }, [backend]);
  return { data };
}
