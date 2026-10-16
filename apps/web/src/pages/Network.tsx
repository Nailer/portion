import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { Empty, Spinner, useAsync } from '../components/ui';
import { api } from '../lib/backend';
import { ago, pot, short } from '../lib/format';

interface Validator { address: string; total: string; own: string; commissionPct: number; points: number; stakeShare: number; pointsShare: number; nominators: number }
interface Finding { severity: 'critical' | 'warning' | 'info' | 'good'; title: string; detail: string; action?: string }
interface Snapshot {
  ts: number; chain: string; specVersion: number; best: number; finalized: number; finalityLag: number; blockTimeSec: number; peers: number; era: number; sessionsPerEra: number;
  validators: Validator[]; nominatorCount: number;
  decentralization: { validatorCount: number; haltSet: number; controlSet: number; topShare: number; score: number };
  modules: { dexPools: number; nominationPools: number; assets: number; nftCollections: number; beefyAuthorities: number; mmrLeaves: number };
  findings: Finding[];
}
interface KeeperRow { id: number; ts: number; kind: string; ref: string; ok: number; tx: string | null; detail: string | null }

export function Network() {
  const { backend, forceDemo } = useApp();
  const { data: s, error, loading } = useAsync(() => api<Snapshot>('/api/network'), [backend]);
  const { data: log } = useAsync(() => api<KeeperRow[]>('/api/keepers').catch(() => []), [backend]);

  if (backend?.mode === 'demo') {
    return <Empty title="The network console needs the live testnet" action={<button className="btn primary" onClick={() => forceDemo(false)}>Switch to the live testnet</button>}>It reads validators, finality and staking directly from Portaldot, so there is nothing to simulate.</Empty>;
  }
  if (loading && !s) return <div className="empty"><Spinner /></div>;
  if (error || !s) return <Empty title="Could not reach the Portion server">{error?.message ?? 'Start it with npm run server.'} The console is served by the Portion server, which reads the chain for you.</Empty>;

  const d = s.decentralization;
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="console">
      <h1>Network console</h1>
      <p className="page-lede">Live from {s.chain}. It does not just display numbers: it tells you what is risky about the network and gives you the native tools to fix it.</p>

      <div className="stat-strip">
        <div className="stat"><small>Best block</small><b>{s.best.toLocaleString()}</b></div>
        <div className="stat"><small>Finality lag</small><b>{s.finalityLag} blocks</b></div>
        <div className="stat"><small>Block time</small><b>{s.blockTimeSec.toFixed(1)} s</b></div>
        <div className="stat"><small>Validators</small><b>{d.validatorCount}</b></div>
        <div className="stat"><small>Halt the chain with</small><b>{d.haltSet} of {d.validatorCount}</b></div>
      </div>

      <div className="section-head"><h2>What to worry about</h2><p>Computed from the current era's staking data.</p></div>
      <div className="findings" style={{ marginTop: 0 }}>
        {s.findings.map((f, i) => (
          <div key={i} className={`finding ${f.severity}`}>
            <i className="sev" />
            <div>
              <h3>{f.title}</h3>
              <p>{f.detail}</p>
              {f.action && <p className="do"><b>What helps:</b> {f.action} {/pool/i.test(f.action) && <Link to="/pools">Open Pool Studio</Link>}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="section-head"><h2>Who secures the chain</h2><p>Era {s.era}. Stake share is what GRANDPA counts; points show who has actually been producing blocks.</p></div>
      <div className="vbar" aria-label="Stake share by validator">{s.validators.map((v) => <i key={v.address} style={{ flexGrow: Math.max(0.02, v.stakeShare) }} title={`${short(v.address)}: ${(v.stakeShare * 100).toFixed(1)}%`} />)}</div>
      <table className="table">
        <thead><tr><th>Validator</th><th className="num">Stake</th><th className="num">Share</th><th className="num">Block points</th><th className="num">Commission</th><th className="num">Nominators</th></tr></thead>
        <tbody>
          {s.validators.map((v) => (
            <tr key={v.address}>
              <td className="mono">{short(v.address, 8, 6)}</td>
              <td className="num">{pot(v.total, 0)}</td>
              <td className="num">{(v.stakeShare * 100).toFixed(1)}%</td>
              <td className="num">{(v.pointsShare * 100).toFixed(1)}%</td>
              <td className="num">{v.commissionPct}%</td>
              <td className="num">{v.nominators}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="two-col" style={{ marginTop: 40 }}>
        <div>
          <div className="section-head" style={{ marginTop: 0 }}><h2>Native modules in use</h2></div>
          <dl className="kv">
            <dt>DEX pools (AssetConversion)</dt><dd>{s.modules.dexPools}</dd>
            <dt>Staking pools (NominationPools)</dt><dd>{s.modules.nominationPools}</dd>
            <dt>Native assets</dt><dd>{s.modules.assets}</dd>
            <dt>NFT collections</dt><dd>{s.modules.nftCollections}</dd>
            <dt>BEEFY authorities</dt><dd>{s.modules.beefyAuthorities}</dd>
            <dt>MMR leaves</dt><dd>{s.modules.mmrLeaves.toLocaleString()}</dd>
            <dt>Runtime</dt><dd>spec {s.specVersion}</dd>
            <dt>Peers on the RPC node</dt><dd>{s.peers}</dd>
          </dl>
          <p className="notice" style={{ marginTop: 16 }}>Operators: scrape <a href="/metrics">/metrics</a> for Prometheus-format gauges, including the halt-set size.</p>
        </div>
        <div>
          <div className="section-head" style={{ marginTop: 0 }}><h2>What the keepers did</h2></div>
          <ul className="log">
            {(log ?? []).slice(0, 10).map((r) => (
              <li key={r.id}><span className={`pill ${r.ok ? 'ok' : 'fail'}`}>{r.kind}</span><span>{r.ref}{r.detail ? ` · ${r.detail}` : ''}</span><time style={{ color: 'var(--ink-3)', fontSize: 13 }}>{ago(r.ts, now)}</time></li>
            ))}
            {!log?.length && <li><span /><span>Keepers have not needed to act yet. They slash defaulted bonds, renew on-chain documents and compound staking rewards.</span><span /></li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
