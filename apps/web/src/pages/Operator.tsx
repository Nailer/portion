import { VerifiedPhoto } from '../components/VerifiedPhoto';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORIES, type ListingView } from '@portion/sdk';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { Health } from '../components/Health';
import { NetworkState } from '../components/NetworkState';
import { Spinner, useAsync } from '../components/ui';
import { AssetScene } from '../components/AssetScene';
import { ago, cadenceLabel, span, usd } from '../lib/format';
import { operatorSummary, paymentPreview } from '../lib/operator';

function PaymentForm({ listing }: { listing: ListingView }) {
  const { backend } = useApp();
  const { balances } = usePassport();
  const { act, busy } = useRunner();
  const { data: rules, error } = useAsync(() => backend!.rules(), [backend]);
  const [amount, setAmount] = useState((Number(listing.minPerPeriod) / 1e6).toString());
  const preview = rules ? paymentPreview(amount, listing.minPerPeriod, rules.revenueFeeBps) : null;
  const enough = !!preview && !!balances && balances.pusd !== null && balances.pusd >= preview.gross;
  return <div className="operator-payment">
    <div><span className="eyebrow">PAY REVENUE</span><h3>Pay revenue to holders.</h3><p>Deposit revenue for <b>{listing.name}</b>. Every staked share receives its allocation.</p></div>
    <form onSubmit={e => { e.preventDefault(); if (preview && enough) act({ kind: 'deposit', id: listing.id, amount: preview.gross }); }}>
      <label htmlFor={`payment-${listing.id}`}>Revenue deposit <span>pUSD</span></label>
      <div className="payment-input"><input id={`payment-${listing.id}`} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-describedby="payment-note"/><button type="button" className="link-btn" onClick={() => setAmount((Number(listing.minPerPeriod) / 1e6).toString())}>Use minimum</button></div>
      <div className="payment-breakdown"><span>Included fee <b>{preview ? usd(preview.fee,6) : '—'}</b></span><span>Shared with holders <b>{preview ? usd(preview.net,6) : '—'}</b></span></div>
      <p id="payment-note" className={preview && !preview.qualifying ? 'payment-warning' : 'payment-hint'}>{listing.vault.totalStaked === 0n ? 'Payments open once there are staked shares to receive them.' : !preview ? 'Enter a positive amount with up to six decimal places.' : !preview.qualifying ? `This payment is below ${usd(listing.minPerPeriod)} and will not reset your payment deadline.` : `Meets the stated minimum. A successful payment resets your ${cadenceLabel(listing.cadence)} schedule.`}</p>
      {error && <p role="alert" className="payment-warning">Could not read fees. Refresh before paying.</p>}
      {preview && balances && !enough && <p className="payment-warning">Your balance is {usd(balances.pusd)}. {backend?.sandbox ? 'Use “Add 1,000 pUSD” in the sandbox bar.' : <Link to="/faucet">Get test tokens →</Link>}</p>}
      <button type="submit" className="btn primary" disabled={busy || !preview || !enough || listing.vault.totalStaked === 0n || listing.health === 'WoundDown'}>Review revenue payment <span>↗</span></button>
    </form>
  </div>;
}

export function Operator() {
  const { backend, tick, refresh, status } = useApp();
  const { passport } = usePassport();
  const { openPassport, act, busy } = useRunner();
  const ready = status === 'ready' && !!backend?.deployed;
  const { data, loading, error } = useAsync(async () => ready ? backend!.listings() : [], [backend, ready, tick]);
  const { data: rules } = useAsync(async () => ready ? backend!.rules() : null, [backend, ready]);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const owned = passport ? (data ?? []).filter(l => l.operator.toLowerCase() === passport.h160.toLowerCase()) : [];
  const ownIds = owned.map(l => l.id).join(',');
  const { data: activity } = useAsync(async () => {
    const rows = await Promise.all(owned.map(l => backend!.activity({ listing: l.id, limit: 8 })));
    return rows.flat().sort((a,b) => b.ts - a.ts || String(b.id).localeCompare(String(a.id), undefined, { numeric: true })).slice(0,10);
  }, [backend, ownIds, tick]);
  const summary = operatorSummary(owned, rules?.saleFeeBps ?? 0);
  const shown = owned.filter(l => (filter === 'all' || l.health === 'Late' || l.health === 'Defaulted') && `${l.name} ${CATEGORIES[l.category]}`.toLowerCase().includes(search.toLowerCase()));
  const paying = owned.find(l => l.id === selected);
  const now = backend?.now() ?? 0;
  const heading = <header className="workspace-heading"><div><span className="eyebrow">{backend?.sandbox ? 'SANDBOX · SIMULATED' : 'TEST NETWORK'}</span><h1>Manage offers</h1><p>See the offers you operate, what is due next, and pay revenue to holders.</p></div><Link className="btn primary" to="/create">Create an offer</Link></header>;
  if (!passport) return <div className="workspace operator-workspace">{heading}<div className="workspace-empty"><div className="empty-orbit" aria-hidden="true">↗</div><h2>Connect to manage your offers.</h2><p>Connect the wallet that operates your offers. You can draft a new offer without connecting.</p><div className="hero-actions"><button className="btn primary" onClick={() => openPassport('Connect the wallet that operates your offers. Reading them is free and signs nothing.')}>Connect wallet</button><Link className="btn ghost" to="/create">Create an offer</Link></div></div></div>;
  if (!ready) return <div className="workspace operator-workspace">{heading}<NetworkState what="your offers"/></div>;
  if (error) return <div className="workspace operator-workspace">{heading}<div className="pv-state" role="alert"><h3>We couldn’t read your offers.</h3><p>{error.message} This does not mean you have none.</p><button className="btn primary" onClick={refresh}>Try again</button></div></div>;
  if (!rules || !data) return <div className="workspace operator-workspace">{heading}<div className="pv-state" role="status"><Spinner label="Reading your offers"/><h3>Reading your offers and the contract’s fees</h3></div></div>;
  return <div className="workspace operator-workspace">
    {heading}
    <>
      <section className="workspace-stats" aria-label="Operator overview"><div><span>Assets managed</span><b>{String(owned.length).padStart(2,'0')}</b><small>{summary.active} active listings</small></div><div><span>Primary funding received</span><b>{usd(summary.gross)}</b><small>Before fees · not business income</small></div><div><span>Revenue & bond distributions</span><b>{usd(summary.distributed)}</b><small>Allocated to staked shares</small></div><div className="stat-dark"><span>Operator bonds held</span><b>{usd(summary.bonds)}</b><small>Separate from available cash</small></div></section>
      {summary.needsAttention > 0 && <div className="attention-strip"><span className="attention-icon">!</span><div><b>{summary.needsAttention} {summary.needsAttention === 1 ? 'asset needs' : 'assets need'} your attention</b><p>Review late payments and defaulted bonds below.</p></div><button className="link-btn" onClick={() => {setFilter('attention');setSearch('');}}>Show assets →</button></div>}
      <div className="workspace-section-head"><div><h2>Your offers</h2></div><div className="workspace-filters"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All assets</button><button aria-pressed={filter === 'attention'} onClick={() => setFilter('attention')}>Needs attention</button></div></div>
      <label className="workspace-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Find one of your assets" aria-label="Search your assets" value={search} onChange={e=>setSearch(e.target.value)}/><small>{shown.length} assets</small></label>
      {!loading && !error && !owned.length && <div className="workspace-empty operator-empty"><div><span className="eyebrow">NO OFFERS YET</span><h2>This account operates no offers.</h2><p>Describe the asset, set shares, price, the deposit schedule you expect to keep, and a bond. Nothing is published until you approve it in your wallet.</p><div className="hero-actions"><Link className="btn primary" to="/create">Create an offer</Link></div></div><AssetScene/></div>}
      {!loading && owned.length > 0 && shown.length === 0 && <div className="workspace-empty"><h3>No matching assets.</h3><button className="link-btn" onClick={()=>{setFilter('all');setSearch('');}}>Clear filters</button></div>}
      <div className="operator-assets">{shown.map(l => {
        const offered = l.vault.sold + l.vault.forSale;
        const pct = offered > 0 ? l.vault.sold / offered * 100 : 0;
        const left = l.lastDepositAt + l.cadence - now;
        return <article className="operator-asset" key={l.id}><div className="operator-asset-image"><VerifiedPhoto hash={l.coverHash} alt={`${l.name}, operator-supplied image`} className="asset-verified-photo"/><span>{CATEGORIES[l.category]}</span></div><div className="operator-asset-main"><div className="operator-asset-heading"><div><span className="eyebrow">ASSET / {String(l.id)}</span><Link to={`/listing/${l.id}`}><h3>{l.name}</h3></Link></div><Health l={l} compact/></div><div className="operator-asset-numbers"><div><small>Raised before fees</small><b>{usd(BigInt(l.vault.sold)*l.vault.salePrice)}</b></div><div><small>Earning shares</small><b>{l.vault.totalStaked.toLocaleString()}</b></div><div><small>Payment schedule</small><b>{cadenceLabel(l.cadence)}</b></div><div><small>Next payment</small><b>{l.health === 'WoundDown' ? 'Closed' : l.escrow && !l.escrow.activated ? 'After the raise settles' : left > 0 ? `In ${span(left)}` : `${span(-left)} overdue`}</b></div></div><div className="operator-asset-bottom"><div><span>{l.saleOpen?`${Math.round(pct)}% of current offer sold`:`${l.vault.sold.toLocaleString()} shares purchased · sale closed`}</span>{l.saleOpen && <div className="funded"><i style={{width:`${pct}%`}}/></div>}</div><Link className="link-btn" to={`/listing/${l.id}`}>View asset ↗</Link><button className="btn dark sm" disabled={l.vault.totalStaked === 0n || l.health === 'WoundDown'} onClick={()=>setSelected(selected === l.id ? null : l.id)}>Pay revenue →</button></div>{l.vault.totalStaked === 0n && l.health !== 'WoundDown' && <p className="asset-waiting">Waiting for earning shares. Share this asset listing with eligible funders.</p>}</div>{paying?.id === l.id && <PaymentForm key={l.id} listing={l}/>}</article>;
      })}</div>
      {owned.length > 0 && <section className="workspace-activity"><div className="workspace-section-head"><div><h2>Recent activity</h2></div><span className="record-label">INDEXED TRANSACTIONS</span></div>{activity?.length ? <ul>{activity.map(a=><li key={`${a.listingId}-${a.id}`}><span className="activity-icon">{a.kind === 'RevenueDeposited' ? '↗' : a.kind === 'Claimed' ? '↙' : '◷'}</span><div><b>{a.kind === 'RevenueDeposited' ? 'Revenue deposited' : a.kind === 'Bought' ? 'Shares purchased' : a.kind === 'Claimed' ? 'Holder claimed income' : a.kind.replace(/([A-Z])/g,' $1').trim()}</b><span>{owned.find(l=>l.id === a.listingId)?.name}</span></div><strong>{a.data.net ? usd(a.data.net) : a.data.cost ? usd(a.data.cost) : a.data.amount ? ['Staked','Unstaked'].includes(a.kind) ? `${a.data.amount} shares` : usd(a.data.amount) : '—'}</strong><time>{ago(a.ts,now)}</time></li>)}</ul> : <p className="workspace-caption">No recent activity available. Indexed history may be incomplete when the API is unavailable.</p>}</section>}
    </>
  </div>;
}
