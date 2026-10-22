import { useEffect, useState } from 'react';
import { TESTNET } from '@portion/sdk';
import { LiveBackend } from '../lib/live';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { api } from '../lib/backend';
import { useAsync } from '../components/ui';
import { Link } from 'react-router-dom';

export function Network() {
  const { backend, reconnect, tick, refresh } = useApp();
  const { passport } = usePassport();
  const { data: service, error: serviceError, loading: serviceLoading } = useAsync(() => api<{ ok: boolean; indexer?: { ready: boolean; historyComplete: boolean; lastIndexed: number; error?: string } }>('/api/health', { signal: AbortSignal.timeout(5000) }), [backend, tick]);
  const [snapshot, setSnapshot] = useState<{ height: string; hash: string; genesis: string; chain: string; runtime: string; timestamp: string; observed: string }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setSnapshot(undefined); setError('');
    const read = async () => {
      if (!(backend instanceof LiveBackend)) return;
      try {
        const chain = backend.chain;
        const hash = await chain.rpc.chain.getFinalizedHead();
        const at = await chain.at(hash);
        const [header, name, timestamp] = await Promise.all([chain.rpc.chain.getHeader(hash), chain.rpc.system.chain(), at.query.timestamp.now()]);
        if (active) { setError(''); setSnapshot({ height: header.number.toString(), hash: hash.toHex(), genesis: chain.genesisHash.toHex(), chain: name.toString(), runtime: `${chain.runtimeVersion.specName} / ${chain.runtimeVersion.specVersion}`, timestamp: new Date(Number(timestamp.toString())).toISOString(), observed: new Date().toISOString() }); }
      } catch (e) { if (active) { setSnapshot(undefined); setError((e as Error).message); } }
    };
    void read(); const interval = setInterval(() => void read(), 15000);
    return () => { active = false; clearInterval(interval); };
  }, [backend]);
  return <div className="console"><span className="eyebrow">DIRECT CHAIN READS</span><h1>Network console</h1><p className="page-lede">These records come directly from the Portaldot RPC. They refresh every 15 seconds. No simulated network statistics are used.</p>
    {error && <p role="alert" className="notice">Live readings unavailable: {error}</p>}
    {!snapshot ? <div className="market-empty"><h2>Waiting for verified network data</h2><button className="btn ghost" onClick={reconnect}>Reconnect</button></div> : <><div className="stat-strip"><div className="stat"><small>Finalized block</small><b>{snapshot.height}</b></div><div className="stat"><small>Contract deployment</small><b>{backend?.deployed ? 'Configured' : 'Not deployed'}</b></div></div><dl className="kv"><dt>Chain</dt><dd>{snapshot.chain}</dd><dt>Runtime</dt><dd>{snapshot.runtime}</dd><dt>RPC source</dt><dd className="mono">{TESTNET.ws}</dd><dt>Finalized block hash</dt><dd className="mono" style={{overflowWrap:'anywhere'}}>{snapshot.hash}</dd><dt>Genesis hash</dt><dd className="mono" style={{overflowWrap:'anywhere'}}>{snapshot.genesis}</dd><dt>Block timestamp</dt><dd>{snapshot.timestamp}</dd><dt>Observed at</dt><dd>{snapshot.observed}</dd></dl></>}
    <section className="readiness-section" aria-labelledby="readiness-title">
      <div className="workspace-section-head"><div><span className="eyebrow">EVIDENCE BEFORE ACTION</span><h2 id="readiness-title">What is ready to use?</h2></div><button className="btn ghost sm" onClick={refresh}>Check services again</button></div>
      <div className="readiness-grid">
        <article><span className={`pill ${snapshot ? 'ok' : ''}`}>{snapshot ? 'Live reading' : 'Unavailable'}</span><h3>Network records</h3><p>{snapshot ? `Finalized block ${snapshot.height}. The source and observation time are shown above.` : 'Waiting for a verified chain response.'}</p></article>
        <article><span className={`pill ${backend?.deployed ? 'ok' : ''}`}>{backend?.deployed ? 'Verified configuration' : 'Not deployed'}</span><h3>Equipment funding</h3><p>{backend?.deployed ? 'Contract rules and the payment asset have been checked on the connected chain. Each listing needs its own backing checks.' : 'Creating assets, buying shares and claiming income remain blocked until the contracts and payment asset are deployed.'}</p></article>
        <article><span className={`pill ${service?.ok && service.indexer?.ready && service.indexer.historyComplete ? 'ok' : ''}`}>{serviceLoading ? 'Checking' : service?.ok && service.indexer?.ready && service.indexer.historyComplete ? 'History available' : 'Unavailable'}</span><h3>Payment history</h3><p>{serviceError ? serviceError.message : service?.indexer?.error ?? (service?.indexer?.ready && service.indexer.historyComplete ? `Indexed through finalized block ${service.indexer.lastIndexed}.` : 'Complete finalized history has not been confirmed by the indexing service.')}</p></article>
        <article><span className={`pill ${passport ? 'ok' : ''}`}>{passport ? 'Account selected' : 'No account selected'}</span><h3>Wallet connection</h3><p>Portaldot Wallet is the primary choice. Actual extension signing and the full asset journey still need live verification.</p><Link to="/guide">See the next stages →</Link></article>
      </div>
    </section></div>;
}
