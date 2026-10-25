import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { Health } from '../components/Health';
import { Spinner, useAsync } from '../components/ui';
import { ago, cadenceLabel, pot, usd } from '../lib/format';

export function Portfolio() {
  const { backend, tick, refresh } = useApp();
  const { passport, balances } = usePassport();
  const { act, openPassport, busy } = useRunner();
  const { data, error, loading } = useAsync(async () => {
    if (!passport) return null;
    const address = passport.address;
    const [listings, positions, activity] = await Promise.all([backend!.listings(), backend!.positions(address), backend!.activity({ actor: passport.h160.toLowerCase(), limit: 20 })]);
    const loose = (await Promise.all(listings.map(async l => ({ l, balance: await backend!.shareBalance(l.assetId, address) })))).filter(r => r.balance > 0n);
    return { address, listings, positions, activity, loose };
  }, [passport?.address, backend, tick]);
  const current = data?.address === passport?.address ? data : null;
  const byId = new Map((current?.listings ?? []).map(l => [l.id,l]));
  const rows = (current?.positions ?? []).filter(p=>byId.has(p.id));
  const value = rows.reduce((n,p)=>n + BigInt(p.staked) * byId.get(p.id)!.vault.salePrice,0n);
  const pending = rows.reduce((n,p)=>n+p.pending,0n);
  const claimable = rows.filter(p=>p.pending>0n).map(p=>p.id);
  const running = (current?.listings ?? []).filter(l=>l.operator.toLowerCase()===passport?.h160.toLowerCase());
  const now = backend!.now();
  if (passport && (!current || loading || error)) return <div className="market-empty"><h2>Portfolio data unavailable</h2><p>{error?.message ?? "Reading your on-chain positions and payment history."}</p></div>;
  return <div className="workspace portfolio-workspace">
    <div className="workspace-topline"><span className="eyebrow"><i className="live-indicator"/>TESTNET FUNDER WORKSPACE</span><button className="link-btn" onClick={refresh}>Refresh data ↻</button></div>
    <header className="workspace-heading"><div><h1>Your portions.<br/><span>Your perspective.</span></h1><p>Follow your shares, see deposited income, and claim what’s ready.</p></div><Link className="btn ghost" to="/">Explore more assets <span>↗</span></Link></header>
    {!passport ? <div className="workspace-empty"><div className="empty-orbit" aria-hidden="true">◔</div><h2>A little ownership starts here.</h2><p>Connect your wallet to see your shares and deposited revenue.</p><button className="btn primary" onClick={openPassport}>Connect wallet</button></div> : <>
      <section className="workspace-stats" aria-label="Portfolio overview"><div><span>Reference value of staked shares</span><b>{usd(value)}</b><small>At listing sale prices · not a resale quote</small></div><div><span>Assets in your portfolio</span><b>{String(rows.length).padStart(2,'0')}</b><small>{rows.reduce((n,p)=>n+p.staked,0).toLocaleString()} staked shares in total</small></div><div><span>Available test balance</span><b>{balances ? usd(balances.pusd) : '—'}</b><small>{balances ? pot(balances.pot,2) : 'Reading your wallet'}</small></div><div className="stat-dark"><span>Income ready to claim</span><b>{usd(pending)}</b><button className="stat-claim" disabled={!claimable.length || busy} onClick={()=>act({kind:'claim',ids:claimable})}>{claimable.length ? 'Review and claim all ↗' : 'Waiting for deposits'}</button></div></section>
      {loading && !current && <div className="workspace-empty"><Spinner label="Loading your portfolio"/></div>}
      {error && <div className="workspace-info" role="alert"><p>We couldn’t read your portfolio. {error.message}</p><button className="btn ghost sm" onClick={refresh}>Try again</button></div>}
      {!loading && current && rows.length === 0 && <div className="workspace-empty"><div className="empty-orbit" aria-hidden="true">◔</div><h2>Choose your first portion.</h2><p>When you buy shares, they appear here. Income becomes claimable after a deposit; previous deposits belong to the people staked at that time.</p><Link className="btn primary" to="/">Find an asset <span>↗</span></Link></div>}
      {!!rows.length && <><div className="workspace-section-head"><div><div className="eyebrow">THE THINGS YOU’RE PART OF</div><h2>Your earning shares.</h2></div><span className="record-label">{rows.length} ASSETS</span></div><div className="position-grid">{rows.map(p=>{
        const l = byId.get(p.id)!;
        const pct = l.vault.totalStaked > 0n ? Number(BigInt(p.staked)*10000n/l.vault.totalStaked)/100 : 0;
        return <article className="position-card" key={p.id}><div className="position-cover"><img src={backend!.docUrl(l.coverHash)} alt=""/><Health l={l} compact/></div><div className="position-body"><span className="eyebrow">PORTION / {String(l.id)}</span><Link to={`/listing/${l.id}`}><h3>{l.name}</h3></Link><div className="position-numbers"><div><small>Shares staked</small><b>{p.staked.toLocaleString()}</b></div><div><small>Ready to claim</small><b>{usd(p.pending)}</b></div></div><div className="position-pool"><span>Your share of the current earning pool</span><b>{pct}%</b><div className="funded"><i style={{width:`${pct}%`}}/></div></div><div className="position-footer"><span>Scheduled {cadenceLabel(l.cadence)}</span><button className="btn primary sm" disabled={p.pending===0n || busy} onClick={()=>act({kind:'claim',ids:[p.id]})}>Claim income ↗</button></div><Link className="position-details" to={`/listing/${l.id}`}>View asset and manage shares →</Link></div></article>;
      })}</div></>}
      {!!current?.loose.length && <section className="workspace-activity"><div className="workspace-section-head"><div><div className="eyebrow">OUTSIDE THE EARNING POOL</div><h2>Shares in your wallet.</h2></div></div><p className="workspace-caption">These shares are not staked. Staking makes them eligible for future deposits. It does not recover missed deposits or repay the purchase price.</p><ul>{current.loose.map(({l,balance})=><li key={l.id}><span className="activity-icon">◔</span><div><Link to={`/listing/${l.id}`}><b>{l.name}</b></Link><span>{balance.toString()} unstaked shares</span></div><button className="btn ghost sm" disabled={busy || l.health === 'WoundDown'} onClick={()=>act({kind:'stake',id:l.id,amount:Number(balance)})}>{l.health === 'WoundDown' ? 'Listing closed' : 'Stake shares ↗'}</button></li>)}</ul></section>}
      {!!running.length && <div className="workspace-info"><span>You also operate {running.length} {running.length===1?'asset':'assets'}. Manage deposits, deadlines and funding in the operator workspace.</span><Link className="btn dark sm" to="/operator">Open workspace →</Link></div>}
      {current && <section className="workspace-activity"><div className="workspace-section-head"><div><div className="eyebrow">FOLLOW THE RECORD</div><h2>Your recent activity.</h2></div><span className="record-label">LATEST AVAILABLE RECORDS</span></div>{current.activity.length ? <ul>{current.activity.map(a=><li key={a.id}><span className="activity-icon">{a.kind==='Claimed'?'↙':'↗'}</span><div><b>{a.kind==='Bought'?'Shares purchased':a.kind==='Claimed'?'Income claimed':a.kind.replace(/([A-Z])/g,' $1').trim()}</b><span>{a.listingId !== null ? byId.get(a.listingId)?.name ?? `Asset ${a.listingId}` : 'Account activity'}</span></div><strong>{a.data.cost ? usd(a.data.cost) : a.data.net ? usd(a.data.net) : a.data.amount && !['Staked','Unstaked'].includes(a.kind) ? usd(a.data.amount) : '—'}</strong><time>{ago(a.ts,now)}</time></li>)}</ul> : <p className="workspace-caption">No recent records available. Testnet history depends on the indexer being available.</p>}</section>}
      <p className="workspace-disclosure">Distributions depend on operator payments. Staked shares have no guaranteed resale value, and the contract does not automatically return purchase principal. All current activity uses test tokens.</p>
    </>}
  </div>;
}
