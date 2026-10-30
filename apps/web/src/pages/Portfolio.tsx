import { VerifiedPhoto } from '../components/VerifiedPhoto';
import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { Health } from '../components/Health';
import { NetworkState } from '../components/NetworkState';
import { Spinner, useAsync } from '../components/ui';
import { ago, cadenceLabel, pot, usd } from '../lib/format';
import { offerStatus } from '../lib/offer-status';

const ACTIVITY: Record<string, string> = { Bought: 'Shares purchased', Claimed: 'Income claimed', Staked: 'Shares staked', Unstaked: 'Shares moved to wallet', RevenueDeposited: 'Revenue deposited', Refunded: 'Payment refunded' };

export function Portfolio() {
  const { backend, tick, refresh, status } = useApp();
  const { passport, balances } = usePassport();
  const { act, openPassport, busy } = useRunner();
  const ready = status === 'ready' && !!backend?.deployed;
  const { data, error, loading } = useAsync(async () => {
    if (!passport || !ready) return null;
    const address = passport.address;
    const [listings, positions, activity] = await Promise.all([backend!.listings(), backend!.positions(address), backend!.activity({ actor: passport.h160.toLowerCase(), limit: 20 }).then(rows => ({ rows, error: undefined as string | undefined })).catch((error: Error) => ({ rows: undefined, error: error.message }))]);
    const loose = await Promise.all(listings.map(async l => ({ id: l.id, balance: await backend!.shareBalance(l.assetId, address) })));
    return { address, listings, positions, activity: activity.rows, activityError: activity.error, loose };
  }, [passport?.address, backend, ready, tick]);
  const current = data?.address === passport?.address ? data : null;
  const heading = <header className="workspace-heading"><div><span className="eyebrow">{backend?.sandbox ? 'SANDBOX · SIMULATED' : 'TEST NETWORK'}</span><h1>My portfolio</h1><p>The shares you hold, which of them earn, and the deposited income you can claim.</p></div>{passport && current && <button className="link-btn" onClick={refresh}>Refresh ↻</button>}</header>;
  if (!passport) return <div className="workspace portfolio-workspace">{heading}<div className="workspace-empty"><div className="empty-orbit" aria-hidden="true">◔</div><h2>Connect to see your shares and claims.</h2><p>Reading your account is free, and nothing is signed until you approve a claim. You can browse assets without connecting.</p><div className="hero-actions"><button className="btn primary" onClick={() => openPassport('Connect the wallet whose shares you want to see. Reading them is free and signs nothing.')}>Connect wallet</button><Link className="btn ghost" to="/assets">Explore assets</Link></div></div></div>;
  if (!ready) return <div className="workspace portfolio-workspace">{heading}<NetworkState what="your shares and claims"/></div>;
  if (error) return <div className="workspace portfolio-workspace">{heading}<div className="pv-state" role="alert"><h3>We couldn’t read your portfolio.</h3><p>{error.message} This does not mean the account is empty.</p><button className="btn primary" onClick={refresh}>Try again</button></div></div>;
  if (!current) return <div className="workspace portfolio-workspace">{heading}<div className="pv-state" role="status"><Spinner label="Reading your shares and claims"/><h3>Reading your shares and claims</h3></div></div>;

  const byId = new Map(current.listings.map(l => [l.id, l]));
  const wallet = new Map(current.loose.map(r => [r.id, r.balance]));
  const holdings = current.listings.map(l => {
    const p = current.positions.find(position => position.id === l.id);
    return { l, staked: p?.staked ?? 0, pending: p?.pending ?? 0n, refundable: p?.refundable ?? 0n, inWallet: wallet.get(l.id) ?? 0n,
      paid: (current.activity ?? []).filter(a => a.kind === 'Bought' && a.listingId === l.id).reduce((n, a) => n + BigInt(a.data.cost ?? 0), 0n) };
  }).filter(h => h.staked > 0 || h.pending > 0n || h.refundable > 0n || h.inWallet > 0n);
  const pending = holdings.reduce((n, h) => n + h.pending, 0n);
  const claimable = holdings.filter(h => h.pending > 0n).map(h => h.l.id);
  const earning = holdings.reduce((n, h) => n + h.staked, 0);
  const inWallet = holdings.reduce((n, h) => n + h.inWallet, 0n);
  const running = current.listings.filter(l => l.operator.toLowerCase() === passport.h160.toLowerCase());
  const openOffers = current.listings.filter(l => offerStatus(l).canBuy).length;
  const now = backend!.now();
  return <div className="workspace portfolio-workspace">
    {heading}
    <section className="workspace-stats" aria-label="Portfolio overview">
      <div className="stat-dark"><span>Income ready to claim</span><b>{usd(pending)}</b>{claimable.length ? <button className="stat-claim" disabled={busy} onClick={() => act({ kind: 'claim', ids: claimable })}>Review claim{claimable.length > 1 ? ` from ${claimable.length} assets` : ''} ↗</button> : <small>Deposited income appears here</small>}</div>
      <div><span>Shares earning</span><b>{earning.toLocaleString()}</b><small>Staked: these receive future deposits</small></div>
      <div><span>Shares in your wallet</span><b>{inWallet.toString()}</b><small>Not staked: these receive nothing yet</small></div>
      <div><span>{backend?.sandbox ? 'Sandbox balance' : 'Test balance'}</span><b>{balances ? usd(balances.pusd) : 'Unavailable'}</b><small>{backend?.sandbox ? 'Pretend money · no value' : balances ? `${pot(balances.pot, 2)} for network fees` : 'Could not be read'}</small></div>
    </section>
    {!holdings.length && <div className="workspace-empty"><div className="empty-orbit" aria-hidden="true">◔</div><h2>This account holds no shares.</h2><p>Shares appear here after a purchase. Income becomes claimable after an operator deposit; earlier deposits belong to whoever was staked at the time. {openOffers === 0 ? 'No offer is open for purchase right now.' : `${openOffers} offer${openOffers === 1 ? ' is' : 's are'} open for purchase.`}</p><div className="hero-actions"><Link className="btn primary" to="/assets">Explore assets</Link></div></div>}
    {!!holdings.length && <><div className="workspace-section-head"><div><h2>What you hold</h2></div><span className="record-label">{holdings.length} ASSET{holdings.length === 1 ? '' : 'S'}</span></div><div className="position-grid">{holdings.map(({ l, staked, pending: ready, refundable, inWallet: loose, paid }) => {
      const pct = l.vault.totalStaked > 0n ? Number(BigInt(staked) * 10000n / l.vault.totalStaked) / 100 : 0;
      const canStake = loose > 0n && loose <= BigInt(Number.MAX_SAFE_INTEGER) && l.health !== 'WoundDown' && (!!l.escrow || l.health !== 'Defaulted');
      return <article className="position-card" key={l.id}><div className="position-cover"><VerifiedPhoto hash={l.coverHash} alt={`${l.name}, operator-supplied image`} className="asset-verified-photo"/><Health l={l} compact/></div><div className="position-body">
        <span className="eyebrow">ASSET {String(l.id)}</span><Link to={`/listing/${l.id}`}><h3>{l.name}</h3></Link>
        <div className="position-numbers"><div><small>Shares earning</small><b>{staked.toLocaleString()}</b></div><div><small>In your wallet</small><b>{loose.toString()}</b></div><div><small>Ready to claim</small><b>{usd(ready)}</b></div><div><small>You paid</small><b>{paid > 0n ? usd(paid) : '—'}</b></div></div>
        {paid === 0n && <p className="position-note">“You paid” comes from published receipts, which can be incomplete.</p>}
        {staked > 0 && <div className="position-pool"><span>Your part of each future deposit</span><b>{pct}%</b><div className="funded"><i style={{ width: `${pct}%` }}/></div></div>}
        <div className="position-footer"><span>Deposits expected {cadenceLabel(l.cadence)}, not guaranteed</span><div className="position-actions">
          {ready > 0n && <button className="btn primary sm" disabled={busy} onClick={() => act({ kind: 'claim', ids: [l.id] })}>Claim {usd(ready)}</button>}
          {refundable > 0n && <button className="btn primary sm" disabled={busy} onClick={() => act({ kind: 'escrow', fn: 'refund', id: l.id })}>Take back {usd(refundable)}</button>}
          {canStake && <button className="btn ghost sm" disabled={busy} onClick={() => act({ kind: 'stake', id: l.id, amount: Number(loose) })}>Stake {loose.toString()} shares</button>}
          <Link className="btn ghost sm" to={`/listing/${l.id}`}>View asset</Link>
        </div></div>
      </div></article>;
    })}</div></>}
    {!!running.length && <div className="workspace-info"><span>You also operate {running.length} {running.length === 1 ? 'asset' : 'assets'}.</span><Link className="btn dark sm" to="/operator">Manage offers →</Link></div>}
    <section className="workspace-activity"><div className="workspace-section-head"><div><h2>Recent activity</h2></div><span className="record-label">{backend?.sandbox ? 'SIMULATED' : 'PUBLISHED RECORDS · MAY BE PARTIAL'}</span></div>{current.activity?.length ? <ul>{current.activity.map(a => <li key={a.id}><span className="activity-icon">{a.kind === 'Claimed' ? '↙' : '↗'}</span><div><b>{ACTIVITY[a.kind] ?? a.kind.replace(/([A-Z])/g, ' $1').trim()}</b><span>{a.listingId !== null ? byId.get(a.listingId)?.name ?? `Asset ${a.listingId}` : 'Account activity'}</span></div><strong>{a.data.cost ? usd(a.data.cost) : a.data.net ? usd(a.data.net) : a.data.amount && !['Staked', 'Unstaked'].includes(a.kind) ? usd(a.data.amount) : a.data.amount ? `${a.data.amount} shares` : '—'}</strong><time>{ago(a.ts, now)}</time></li>)}</ul> : <p className="workspace-caption">{current.activityError ? `Published history is unavailable: ${current.activityError}. Your shares and claims above are read separately.` : 'No published records for this account. Transactions made outside this app may be absent.'}</p>}</section>
    <p className="workspace-disclosure">Distributions depend on operator payments. Shares have no guaranteed resale value, and the contract does not automatically return purchase payments. {backend?.sandbox ? 'Everything here is simulated.' : 'All current activity uses test tokens.'}</p>
  </div>;
}
