import { useEffect, useState } from 'react';
import { TESTNET } from '@portion/sdk';
import { LiveBackend } from '../lib/live';
import { useApp } from '../state/app';

export function Network() {
  const { backend, reconnect } = useApp();
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
    <p className="notice">Asset revenue, keeper history and document verification require deployed contracts and a reachable indexing service. Those records are currently unavailable.</p></div>;
}
