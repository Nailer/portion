import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, type ListingView } from '@portion/sdk';
import { useApp } from '../state/app';
import { useRunner } from '../state/runner';
import { Wheel } from '../components/Wheel';
import { Health } from '../components/Health';
import { Empty, Spinner, useAsync } from '../components/ui';
import { cadenceLabel, economics, usd } from '../lib/format';

export function ListingRow({ l }: { l: ListingView }) {
  const { backend } = useApp();
  const e = economics(l);
  return (
    <Link to={`/listing/${l.id}`} className="row">
      <img className="thumb" src={backend!.docUrl(l.coverHash)} alt="" loading="lazy" />
      <div>
        <h3>{l.name}</h3>
        <p className="sum">{l.summary}</p>
        <p className="meta">{CATEGORIES[l.category] ?? 'Other'} · pays {cadenceLabel(l.cadence)}</p>
      </div>
      <div className="cell col-funded">
        <small>{l.vault.forSale > 0 && l.saleOpen ? `${l.vault.forSale.toLocaleString()} shares left` : 'Sold out'}</small>
        <b>{Math.round(e.soldPct * 100)}% sold</b>
        <div className="funded"><i style={{ width: `${e.soldPct * 100}%` }} /></div>
      </div>
      <div className="cell col-price"><small>Per share</small><b>{usd(l.vault.salePrice)}</b></div>
      <div className="cell col-yield"><small>Yield at the promised minimum</small><b>{(e.apyAtFloor * 100).toFixed(0)}% a year</b></div>
      <div className="col-health"><Health l={l} compact /></div>
    </Link>
  );
}

function HeroWheel({ l }: { l: ListingView }) {
  const [pick, setPick] = useState(Math.max(1, Math.round(Math.min(l.vault.forSale, l.totalShares) * 0.12)));
  const e = economics(l);
  const sel = Math.min(pick, Math.max(1, l.vault.forSale));
  const cost = sel * e.price;
  const weekly = (sel * e.perShareFloor);
  return (
    <div className="hero-wheel">
      <Wheel total={l.totalShares} others={Math.max(0, l.vault.sold)} owned={0} selecting={sel} available={l.vault.forSale} onSelect={setPick} size={260} label={`Choose how much of ${l.name} to own`} />
      <div className="readout">
        <div className="big">{usd(cost * 1e6, 0)}</div>
        <div className="small">buys {sel.toLocaleString()} shares of {l.name}, at least {usd(weekly * 1e6)} {cadenceLabel(l.cadence)}</div>
      </div>
      <div className="pick"><small>Drag the wheel, or use the arrow keys</small></div>
      <Link className="btn dark sm" to={`/listing/${l.id}`}>See this listing</Link>
    </div>
  );
}

export function Home() {
  const { backend, tick, forceDemo } = useApp();
  const { openPassport } = useRunner();
  const { data, loading, error } = useAsync(() => backend!.listings(), [backend, tick]);
  const [cat, setCat] = useState<number | 'all'>('all');
  const featured = useMemo(() => (data ?? []).find((l) => l.saleOpen && l.vault.forSale > 0), [data]);
  const shown = (data ?? []).filter((l) => cat === 'all' || l.category === cat);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Own a portion of things that earn.</h1>
          <p className="lede">
            Buy a slice of a solar kiosk, an e-bike fleet or a cold room, and get paid when it takes money. Operators list in one tap.
            If they stop paying, their bond goes to the people who hold shares.
          </p>
          <div className="cta">
            <a className="btn primary" href="#market">Browse the market</a>
            <Link className="btn ghost" to="/create">Tokenize something</Link>
          </div>
        </div>
        {featured ? <HeroWheel l={featured} /> : <div className="hero-wheel">{loading ? <Spinner /> : <p className="notice">Nothing is for sale yet. Be the first to list.</p>}</div>}
      </section>

      <section id="market">
        <div className="section-head">
          <h2>The market</h2>
          <p>Every listing is a real deed, locked and split into shares by the chain. Compare what each operator has promised to pay.</p>
        </div>
        <div className="tabs" role="tablist" style={{ maxWidth: 'fit-content', flexWrap: 'wrap', margin: '16px 0 18px' }}>
          <button role="tab" aria-selected={cat === 'all'} onClick={() => setCat('all')}>All</button>
          {CATEGORIES.map((c, i) => (data ?? []).some((l) => l.category === i) && <button key={c} role="tab" aria-selected={cat === i} onClick={() => setCat(i)}>{c}</button>)}
        </div>
        <div className="market">
          <div className="row head" aria-hidden><span /><span>Listing</span><span>Sold</span><span className="col-price">Price</span><span className="col-yield">Yield</span><span>Operator record</span></div>
          {loading && !data && <div className="empty"><Spinner label="Loading listings" /></div>}
          {error && <div className="empty"><h3>Could not read the market</h3><p>{error.message}</p><button className="btn primary" onClick={() => forceDemo(true)}>Explore in simulated mode</button></div>}
          {shown.map((l) => <ListingRow key={l.id} l={l} />)}
          {!loading && !error && data && shown.length === 0 && (
            <Empty title="No listings here yet" action={<Link className="btn primary" to="/create">Tokenize the first one</Link>}>
              Operators who want to raise money against something that earns can list it in about a minute.
            </Empty>
          )}
        </div>
        <p className="notice" style={{ marginTop: 28 }}>
          Revenue is reported by operators and enforced by a bond, not guaranteed. This is a hackathon testnet: nothing here has monetary value.
          {' '}<button className="link-btn" onClick={openPassport}>Open a Passport</button> to try buying.
        </p>
      </section>
    </>
  );
}
