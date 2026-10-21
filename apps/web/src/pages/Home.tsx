import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, type ListingView } from '@portion/sdk';
import { useApp } from '../state/app';
import { Health } from '../components/Health';
import { AssetScene } from '../components/AssetScene';
import { Spinner, useAsync } from '../components/ui';
import { cadenceLabel, economics, usd } from '../lib/format';

export function ListingRow({ l }: { l: ListingView }) {
  const { backend } = useApp();
  const e = economics(l);
  return <Link to={`/listing/${l.id}`} className="asset-card">
    <div className={`asset-card-art category-${l.category}`}>
      <img src={backend!.docUrl(l.coverHash)} alt="" loading="lazy" />
      <span className="asset-category">{CATEGORIES[l.category] ?? 'Other'}</span>
      <span className="asset-open">↗</span>
    </div>
    <div className="asset-card-body">
      <div className="asset-card-top"><span>PORTION / {String(l.id + 1).padStart(3, '0')}</span><Health l={l} compact /></div>
      <h3>{l.name}</h3><p className="asset-summary">{l.summary}</p>
      <div className="asset-figures"><div><small>Price per share</small><b>{usd(l.vault.salePrice)}</b></div><div><small>Payment schedule</small><b>{cadenceLabel(l.cadence)}</b></div></div>
      <div className="funding-label"><span>{Math.round(e.soldPct * 100)}% of offered shares sold</span><b>{l.saleOpen ? `${l.vault.forSale.toLocaleString()} left` : 'Sale closed'}</b></div>
      <div className="funded"><i style={{ width: `${Math.min(100, e.soldPct * 100)}%` }} /></div>
      <div className="asset-card-bottom"><span>Operator bond <b>{usd(l.vault.bond, 0)}</b></span><strong>View asset <span>→</span></strong></div>
    </div>
  </Link>;
}

function FeaturedAsset({ listing }: { listing?: ListingView }) {
  const [shares, setShares] = useState(10);
  const available = listing?.vault.forSale ?? 100;
  const count = Math.min(shares, available);
  return <div className="feature-scene">
    <div className="scene-label"><span className="live-indicator"/> {listing ? 'Explore an available listing' : 'A little ownership. A bigger possibility.'}<span>01 / PORTION</span></div>
    <AssetScene />
    <div className="scene-caption"><span>PRODUCTIVE ASSETS, SHARED.</span><span>Energy · Mobility · Equipment</span></div>
    <div className="ownership-preview">
      <div className="preview-heading"><span>{listing ? CATEGORIES[listing.category] : 'THE IDEA IN ACTION'}</span><span className="preview-icon">↗</span></div>
      <h3>{listing?.name ?? 'A solar charging kiosk.'}</h3>
      <p>{listing ? 'Choose a portion. Review the terms before you buy.' : 'An operator runs it. People fund portions. Deposited revenue is shared.'}</p>
      {listing ? <>
        <div className="preview-amount"><div><small>Your portion</small><b>{count} <span>shares</span></b></div><div><small>Purchase amount</small><b>{usd(BigInt(count) * listing.vault.salePrice, 0)}</b></div></div>
        <input className="portion-range" type="range" min="1" max={Math.max(1, Math.min(100, available))} value={count} onChange={e => setShares(Number(e.target.value))} aria-label="Preview number of shares"/>
        <Link to={`/listing/${listing.id}?shares=${count}`} className="preview-link">Explore this asset <span>→</span></Link>
      </> : <Link to="/guide" className="preview-link">See how Portion works <span>→</span></Link>}
    </div>
  </div>;
}

export function Home() {
  const { backend, tick, forceDemo, status } = useApp();
  const { data, loading, error } = useAsync(() => backend ? backend.listings() : Promise.resolve([] as ListingView[]), [backend, tick]);
  const [cat, setCat] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const featured = useMemo(() => (data ?? []).find(l => l.saleOpen && l.vault.forSale > 0), [data]);
  const shown = (data ?? []).filter(l => (cat === 'all' || l.category === cat) && `${l.name} ${l.summary} ${CATEGORIES[l.category]}`.toLowerCase().includes(search.toLowerCase()));
  const totalPaid = (data ?? []).reduce((n, l) => n + l.vault.totalRevenue, 0n);
  const mode = backend?.mode === 'demo' ? 'Simulation' : 'Testnet';
  return <div className="home-redesign">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line"/> SMALL PORTIONS. REAL POSSIBILITIES.</div>
        <h1 id="home-title">Good things<br/>earn.<br/><span>Own a portion.</span></h1>
        <p className="home-lede">Help fund a solar kiosk, an electric bike fleet, or a cold room. Buy shares and receive a portion of the revenue its operator deposits.</p>
        <div className="hero-actions"><a className="btn primary" href="#market">Explore assets <span>↗</span></a><Link className="hero-secondary" to="/create">Raise funds for your asset <span>→</span></Link></div>
        <div className="hero-assurance"><span className="assurance-mark">↳</span><p>See the terms. Follow the payments.<br/><b>Understand what you’re funding.</b></p></div>
      </div>
      <FeaturedAsset key={featured?.id ?? 'intro'} listing={featured}/>
    </section>

    <div className="product-strip"><span>BUILT FOR THINGS<br/><b>THAT KEEP WORKING.</b></span><span>☀ <b>Clean energy</b></span><span>↗ <b>Electric mobility</b></span><span>▦ <b>Everyday infrastructure</b></span><Link to="/guide">How it works <span>→</span></Link></div>

    <section className="how-section" aria-labelledby="how-title">
      <div className="how-intro"><div className="eyebrow">THE SHORT VERSION</div><h2 id="how-title">From a working asset <br/>to a shared opportunity.</h2><p>One operator. Many portions. A clear record of what happens next.</p></div>
      <div className="how-steps">
        <article><span className="step-number">01</span><h3>Find your portion.</h3><p>Explore an asset, read its terms, and review the operator’s bond and payment schedule.</p></article>
        <article><span className="step-number">02</span><h3>Fund what works.</h3><p>Choose your shares. Your payment goes to the operator, minus the disclosed platform fee.</p></article>
        <article><span className="step-number">03</span><h3>Follow the income.</h3><p>Purchased shares are staked automatically. Claim your allocation when revenue is deposited.</p></article>
      </div>
    </section>

    <section id="market" className="market-section" aria-labelledby="market-title">
      <div className="market-heading"><div><div className="eyebrow">FIND SOMETHING YOU BELIEVE IN</div><h2 id="market-title">Small shares.<br/><span>Working possibilities.</span></h2></div><p>Explore the terms behind every opportunity.<br/>Revenue is operator-reported and returns are not guaranteed.</p></div>
      <div className="market-toolbar"><div className="category-filters" role="group" aria-label="Filter assets by category"><button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All assets</button>{CATEGORIES.map((c,i) => (data ?? []).some(l => l.category === i) && <button key={c} aria-pressed={cat === i} onClick={() => setCat(i)}>{c}</button>)}</div><label className="market-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Find an asset" aria-label="Search assets" value={search} onChange={e => setSearch(e.target.value)}/></label></div>
      <div className="market-context"><span><i className="live-indicator"/>{mode} market</span><span aria-live="polite">{shown.length} {shown.length === 1 ? 'asset' : 'assets'}{search ? ' matching your search' : ' to explore'}</span></div>
      {status === 'connecting' && <div className="market-empty" role="status"><Spinner/><h3>Connecting to the testnet</h3><p>You can read about Portion above while the market connects.</p><button className="btn ghost" onClick={() => forceDemo(true)}>Try the interactive simulation</button></div>}
      {status === 'offline' && <div className="market-empty"><h3>The testnet is currently unavailable.</h3><p>Explore the full flow with simulated funds while the network is offline.</p><button className="btn primary" onClick={() => forceDemo(true)}>Explore the simulation →</button></div>}
      {status === 'ready' && loading && !data?.length && <div className="market-empty"><Spinner label="Loading assets"/></div>}
      {error && <div className="market-empty" role="alert"><h3>We couldn’t load the market.</h3><p>{error.message}</p><button className="btn ghost" onClick={() => forceDemo(true)}>Try the simulation</button></div>}
      <div className="asset-grid">{shown.map(l => <ListingRow key={l.id} l={l}/>)}</div>
      {status === 'ready' && !loading && !error && shown.length === 0 && <div className="market-empty"><span className="empty-symbol">↗</span><h3>{search || cat !== 'all' ? 'No assets match just yet.' : 'The first portion starts here.'}</h3><p>{search || cat !== 'all' ? 'Try a different search or explore all categories.' : backend?.deployed ? 'The market is ready for its first listing. You can create an asset or explore the simulation.' : 'Portion is connected to Portaldot. Contract deployment is the next milestone; the interactive simulation is ready to explore.'}</p>{search || cat !== 'all' ? <button className="btn ghost" onClick={() => {setCat('all');setSearch('');}}>Clear filters</button> : <div className="hero-actions"><button className="btn primary" onClick={() => forceDemo(true)}>Try the simulation <span>↗</span></button>{backend?.deployed && <Link className="btn ghost" to="/create">List an asset</Link>}</div>}</div>}
      {!!data?.length && <div className="market-totals"><div><span>{mode} assets</span><b>{data.length.toString().padStart(2,'0')}</b></div><div><span>{mode} revenue distributed</span><b>{usd(totalPaid)}</b></div><p>{backend?.mode === 'demo' ? 'Illustrative assets and simulated funds. These figures are not real investment activity.' : 'Figures are read from the testnet. Test tokens have no monetary value.'}</p></div>}
    </section>

    <section className="operator-callout"><div><div className="eyebrow">FOR THE PEOPLE MAKING THINGS WORK</div><h2>Your asset has potential.<br/><span>Give people a portion.</span></h2><p>Set your terms, offer shares, and manage revenue payments in one place.</p><Link className="btn primary" to="/create">Create an asset listing <span>↗</span></Link></div><div className="operator-mark" aria-hidden="true"><span>p</span><i>↗</i></div></section>
    <div className="risk-note"><b>Know what a portion means.</b><p>Onchain shares record participation in a listing; they do not independently prove legal title to physical equipment. Revenue depends on the operator. A bond is limited compensation and does not guarantee repayment. This build uses test tokens only.</p><Link to="/business">See how the money works ↗</Link></div>
  </div>;
}
