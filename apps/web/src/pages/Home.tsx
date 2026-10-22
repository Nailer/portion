import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, type ListingView } from '@portion/sdk';
import { useApp } from '../state/app';
import { useRunner } from '../state/runner';
import { Health } from '../components/Health';
import { Icon } from '../components/Icon';
import { InfrastructureScene } from '../components/InfrastructureScene';
import { Spinner, useAsync } from '../components/ui';
import { cadenceLabel, economics, usd } from '../lib/format';

export function ListingRow({ l }: { l: ListingView }) {
  const { backend } = useApp();
  const e = economics(l);
  return <Link to={`/listing/${l.id}`} className="asset-card">
    <div className={`asset-card-art category-${l.category}`}><img src={backend!.docUrl(l.coverHash)} alt="" loading="lazy"/><span className="asset-category">{CATEGORIES[l.category] ?? 'Other'}</span><span className="asset-open"><Icon name="external" size={17}/></span></div>
    <div className="asset-card-body"><div className="asset-card-top"><span>ASSET {String(l.id + 1).padStart(2,'0')}</span><Health l={l} compact/></div><h3>{l.name}</h3><p className="asset-summary">{l.summary}</p>
      <div className="asset-figures"><div><small>Per share</small><b>{usd(l.vault.salePrice)}</b></div><div><small>Payment schedule</small><b>{cadenceLabel(l.cadence)}</b></div></div>
      <div className="funding-label"><span>{Math.round(e.soldPct * 100)}% of offer funded</span><b>{l.saleOpen ? `${l.vault.forSale.toLocaleString()} available` : 'Sale closed'}</b></div><div className="funded"><i style={{width:`${Math.min(100,e.soldPct * 100)}%`}}/></div>
      <div className="asset-card-bottom"><span>Operator bond <b>{usd(l.vault.bond,0)}</b></span><strong>View asset <Icon name="arrow" size={15}/></strong></div>
    </div>
  </Link>;
}

export function Home() {
  const { backend, tick, forceDemo, status } = useApp();
  const { openPassport } = useRunner();
  const { data, loading, error } = useAsync(() => backend ? backend.listings() : Promise.resolve([] as ListingView[]), [backend,tick]);
  const [cat,setCat] = useState<number|'all'>('all');
  const [search,setSearch] = useState('');
  const shown = (data ?? []).filter(l => (cat === 'all' || l.category === cat) && `${l.name} ${l.summary} ${CATEGORIES[l.category]}`.toLowerCase().includes(search.toLowerCase()));
  const totalPaid = (data ?? []).reduce((sum,l) => sum + l.vault.totalRevenue,0n);
  const demo = backend?.mode === 'demo';
  return <div className="brand-home">
    <section className="brand-hero" aria-labelledby="home-title">
      <div className="brand-hero-copy"><div className="hero-tag"><span/>PRODUCTIVE ASSETS. SHARED OPPORTUNITY.</div><h1 id="home-title">Fund working assets.<br/><span>Follow the income.</span></h1><p>Solar installations. Electric fleets. Essential equipment. Help fund the things people use—and track your share of the revenue their operators deposit.</p><div className="hero-actions"><a className="btn primary" href="#market">Explore assets <Icon name="arrow" size={18}/></a><Link className="btn ghost" to="/create">Raise funds <Icon name="external" size={16}/></Link></div><button className="hero-demo-link" onClick={openPassport}><span className="play-symbol">▷</span>Try both sides of the story <span>No wallet needed</span></button><div className="hero-trust"><Icon name="shield" size={16}/><span>Clear terms. Visible payments. No guaranteed returns.</span></div></div>
      <div className="capital-visual"><div className="visual-top"><span className="visual-signal"/><span>THE PORTION MODEL</span><small>01 — 03</small></div><InfrastructureScene/><div className="capital-flow"><div><span>01</span><b>Fund an asset</b><small>Participants buy shares</small></div><Icon name="arrow" size={16}/><div><span>02</span><b>Keep it working</b><small>An operator runs it</small></div><Icon name="arrow" size={16}/><div><span>03</span><b>Share the income</b><small>Claim deposited revenue</small></div></div><div className="visual-footer"><span><Icon name="globe" size={13}/> Designed for global infrastructure</span><span>Illustrative model</span></div></div>
    </section>
    <div className="platform-rail"><span className="rail-label">BUILT AROUND<br/><b>A WORKING BUSINESS</b></span><div><Icon name="bolt"/><span>Productive assets</span></div><div><Icon name="layers"/><span>Shared participation</span></div><div><Icon name="shield"/><span>Operator accountability</span></div><Link to="/guide">The complete picture <Icon name="external" size={15}/></Link></div>
    <section id="market" className="market-section" aria-labelledby="market-title"><div className="market-heading"><div><div className="eyebrow">DISCOVER YOUR NEXT PERSPECTIVE</div><h2 id="market-title">Explore the possibilities.</h2></div><p>Read the terms. Understand the business.<br/>Decide what deserves your participation.</p></div>
      <div className="market-toolbar"><div className="category-filters" role="group" aria-label="Filter assets by category"><button aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All assets</button>{CATEGORIES.map((name,i) => (data ?? []).some(l => l.category === i) && <button key={name} aria-pressed={cat === i} onClick={() => setCat(i)}>{name}</button>)}</div><label className="market-search"><Icon name="search" size={17}/><input type="search" placeholder="Find an asset" aria-label="Search assets" value={search} onChange={e => setSearch(e.target.value)}/></label></div>
      <div className="market-context"><span><i className="live-indicator"/>{demo ? 'SIMULATED MARKET' : 'TESTNET MARKET'}</span><span aria-live="polite">{shown.length} {shown.length === 1 ? 'asset' : 'assets'}{search ? ' matching your search' : ' to explore'}</span></div>
      {status === 'connecting' && <div className="market-empty" role="status"><Spinner/><h3>Connecting to Portaldot</h3><p>You can explore the simulation while the network connects.</p><button className="btn ghost" onClick={() => forceDemo(true)}>Try the simulation</button></div>}
      {status === 'offline' && <div className="market-empty"><h3>The testnet is currently unavailable.</h3><p>The complete simulation is ready to explore.</p><button className="btn primary" onClick={() => forceDemo(true)}>Explore the simulation <Icon name="arrow"/></button></div>}
      {status === 'ready' && loading && !data?.length && <div className="market-empty"><Spinner label="Loading assets"/></div>}
      {error && <div className="market-empty" role="alert"><h3>We couldn’t load the market.</h3><p>{error.message}</p><button className="btn ghost" onClick={() => forceDemo(true)}>Try the simulation</button></div>}
      <div className="asset-grid">{shown.map(l => <ListingRow key={l.id} l={l}/>)}</div>
      {status === 'ready' && !loading && !error && !shown.length && <div className="market-empty"><Icon name="layers" size={36}/><h3>{search || cat !== 'all' ? 'No assets match your search.' : 'The first listing starts here.'}</h3><p>{search || cat !== 'all' ? 'Try a different search or category.' : backend?.deployed ? 'Create a listing or try the complete demo.' : 'Portion’s live contracts are not deployed yet. Try the working simulation.'}</p>{search || cat !== 'all' ? <button className="btn ghost" onClick={() => {setSearch('');setCat('all');}}>Clear filters</button> : <button className="btn primary" onClick={() => forceDemo(true)}>Try the simulation</button>}</div>}
      {!!data?.length && <div className="market-totals"><div><span>{demo ? 'Demo' : 'Testnet'} assets</span><b>{String(data.length).padStart(2,'0')}</b></div><div><span>{demo ? 'Simulated' : 'Testnet'} revenue allocated</span><b>{usd(totalPaid)}</b></div><p>{demo ? 'An interactive preview. These are example assets and simulated payments, not investment activity.' : 'Read from the testnet. Test tokens have no monetary value.'}</p></div>}
    </section>
    <section className="participation-section"><div className="participation-heading"><span className="eyebrow">TWO SIDES. ONE CLEAR RECORD.</span><h2>A place for the people<br/>behind the possibilities.</h2></div><div className="participation-grid"><article><span className="audience-icon"><Icon name="building" size={27}/></span><div className="eyebrow">FOR OPERATORS</div><h3>Build your next chapter.</h3><p>Present your asset, set funding terms and manage revenue payments in a workspace designed around your operation.</p><Link to="/operator">Explore the workspace <Icon name="arrow" size={18}/></Link></article><article><span className="audience-icon"><Icon name="layers" size={27}/></span><div className="eyebrow">FOR FUNDERS</div><h3>Understand your portion.</h3><p>Review a business, follow its payment record and claim the income allocated to your participating shares.</p><Link to="/portfolio">See your portfolio <Icon name="arrow" size={18}/></Link></article></div></section>
    <section className="brand-callout"><div><span className="eyebrow">FROM AN IDEA TO AN EVERYDAY ASSET</span><h2>Start with something<br/>that keeps working.</h2><p>A clear funding story. A visible payment record. Room to grow.</p></div><Link className="btn primary" to="/create">Create an asset listing <Icon name="arrow"/></Link><div className="callout-orbit" aria-hidden="true"/></section>
    <div className="risk-note"><Icon name="shield" size={23}/><div><b>Participation starts with understanding.</b><p>A listing does not independently establish legal ownership of equipment. Income depends on operator payments; capital and resale are not guaranteed. This build uses test tokens only.</p></div><Link to="/business">Follow the money <Icon name="external" size={14}/></Link></div>
  </div>;
}
