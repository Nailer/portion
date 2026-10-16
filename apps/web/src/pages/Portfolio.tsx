import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { useRunner } from '../state/runner';
import { Health } from '../components/Health';
import { Empty, Spinner, useAsync } from '../components/ui';
import { ago, cadenceLabel, economics, pot, usd } from '../lib/format';

export function Portfolio() {
  const { backend, tick } = useApp();
  const { passport, balances } = usePassport();
  const { act, openPassport } = useRunner();
  const { data: listings } = useAsync(() => backend!.listings(), [backend, tick]);
  const { data: positions, loading } = useAsync(async () => (passport ? backend!.positions(passport.address) : []), [passport?.address, backend, tick]);
  const { data: activity } = useAsync(async () => (passport ? backend!.activity({ actor: passport.h160.toLowerCase(), limit: 12 }) : []), [passport?.address, tick]);
  const { data: loose } = useAsync(async () => {
    if (!passport || !listings) return [];
    const rows = await Promise.all(listings.map(async (l) => ({ l, bal: await backend!.shareBalance(l.assetId, passport.address) })));
    return rows.filter((r) => r.bal > 0n);
  }, [passport?.address, listings, tick]);

  if (!passport) {
    return (
      <Empty title="Open a Passport to see what you own" action={<button className="btn primary" onClick={openPassport}>Open a Passport</button>}>
        Your Passport holds your shares, your pUSD and your claim on every listing you have bought into.
      </Empty>
    );
  }
  if (loading && !positions) return <div className="empty"><Spinner /></div>;

  const byId = new Map((listings ?? []).map((l) => [l.id, l]));
  const rows = (positions ?? []).filter((p) => byId.has(p.id));
  const value = rows.reduce((a, p) => a + BigInt(p.staked) * byId.get(p.id)!.vault.salePrice, 0n);
  const pending = rows.reduce((a, p) => a + p.pending, 0n);
  const claimable = rows.filter((p) => p.pending > 0n).map((p) => p.id);
  const running = (listings ?? []).filter((l) => l.operator.toLowerCase() === passport.h160.toLowerCase());
  const now = backend!.now();

  return (
    <div>
      <h1 className="page-title">Your portfolio</h1>
      <div className="stat-strip">
        <div className="stat"><small>Shares, at today's sale price</small><b>{usd(value)}</b></div>
        <div className="stat"><small>Revenue waiting for you</small><b>{usd(pending)}</b></div>
        <div className="stat"><small>Cash in your Passport</small><b>{balances ? usd(balances.pusd) : '…'}</b><small>{balances ? pot(balances.pot, 2) : ''}</small></div>
      </div>

      <div className="section-head"><h2>What you own</h2>{claimable.length > 0 && <button className="btn primary sm" onClick={() => act({ kind: 'claim', ids: claimable })}>Claim all {usd(pending)} in one go</button>}</div>
      {rows.length === 0 ? (
        <Empty title="You do not own any shares yet" action={<Link className="btn primary" to="/">Browse the market</Link>}>Buy a slice of something that earns and it will show up here with the revenue it has paid you.</Empty>
      ) : (
        <table className="table">
          <thead><tr><th>Listing</th><th className="num">Shares</th><th className="num">Waiting</th><th>Operator record</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => {
              const l = byId.get(p.id)!;
              const e = economics(l);
              return (
                <tr key={p.id}>
                  <td><Link to={`/listing/${l.id}`}><b>{l.name}</b></Link><br /><small style={{ color: 'var(--ink-3)' }}>pays {cadenceLabel(l.cadence)} · {(e.apyAtFloor * 100).toFixed(0)}% a year at the minimum</small></td>
                  <td className="num">{p.staked.toLocaleString()}</td>
                  <td className="num">{usd(p.pending)}</td>
                  <td style={{ minWidth: 160 }}><Health l={l} compact /></td>
                  <td className="num"><button className="btn ghost sm" disabled={p.pending === 0n} onClick={() => act({ kind: 'claim', ids: [p.id] })}>Claim</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {(loose?.length ?? 0) > 0 && (
        <>
          <div className="section-head"><h2>Shares outside the vault</h2><p>Shares you hold but are not earning yet, for example ones bought on the native DEX. Stake them to start earning.</p></div>
          <table className="table"><tbody>
            {loose!.map(({ l, bal }) => (
              <tr key={l.id}><td><b>{l.name}</b></td><td className="num">{bal.toString()} shares</td><td className="num"><button className="btn primary sm" onClick={() => act({ kind: 'stake', id: l.id, amount: Number(bal) })}>Stake to earn</button></td></tr>
            ))}
          </tbody></table>
        </>
      )}

      {running.length > 0 && (
        <>
          <div className="section-head"><h2>Listings you run</h2></div>
          <table className="table"><tbody>
            {running.map((l) => (
              <tr key={l.id}>
                <td><Link to={`/listing/${l.id}`}><b>{l.name}</b></Link><br /><small style={{ color: 'var(--ink-3)' }}>bond {usd(l.vault.bond)} · paid so far {usd(l.vault.totalRevenue)}</small></td>
                <td style={{ minWidth: 180 }}><Health l={l} /></td>
                <td className="num"><Link className="btn ghost sm" to={`/listing/${l.id}`}>Manage</Link></td>
              </tr>
            ))}
          </tbody></table>
        </>
      )}

      <div className="section-head"><h2>Recent activity</h2></div>
      <ul className="activity">
        {(activity ?? []).map((a) => <li key={a.id}><span>{a.kind.replace(/([A-Z])/g, ' $1').trim()}{a.listingId !== null ? ` · ${byId.get(a.listingId)?.name ?? `listing #${a.listingId}`}` : ''}</span><time>{ago(a.ts, now)}</time></li>)}
        {activity && !activity.length && <li><span>Nothing yet.</span></li>}
      </ul>
    </div>
  );
}
