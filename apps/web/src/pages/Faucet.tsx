import { useState } from 'react';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { pot, usd } from '../lib/format';
import { api, type DripResult } from '../lib/backend';
import { CopyButton, useAsync } from '../components/ui';
import { explorerBlock } from '../lib/format';

interface FaucetStatus { address: string; balance: string; dripPot: string; dripPusd: string; cooldownSeconds: number; remainingToday: number }

export function Faucet() {
  const { backend, refresh } = useApp();
  const { passport } = usePassport();
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<DripResult>();
  const [err, setErr] = useState<string>();
  const { data: status } = useAsync(async () => (backend!.mode === 'live' ? api<FaucetStatus>('/api/faucet').catch(() => undefined) : undefined), [backend]);

  const target = addr.trim() || passport?.address || '';
  const go = async () => {
    setBusy(true); setErr(undefined); setRes(undefined);
    try { setRes(await backend!.drip(target)); refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="two-col" style={{ alignItems: 'start' }}>
      <div>
        <h1 className="page-title">Testnet faucet</h1>
        <p className="page-lede">The faucet requires a reachable, separately funded service. Only amounts returned by that service are shown. If unavailable, this page cannot send tokens.</p>
        <div className="field" style={{ marginTop: 28 }}>
          <label htmlFor="addr">Address</label>
          <input id="addr" type="text" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={passport ? `${passport.address} (your account)` : '5… or 0x…'} spellCheck={false} />
          <p className="hint">Only public addresses belong here. Never enter a recovery phrase or private key.</p>
        </div>
        <button className="btn primary" disabled={busy || !target || !status} onClick={go}>{busy ? 'Sending…' : !status ? 'Live faucet unavailable' : `Request ${pot(status.dripPot, 0)}`}</button>
        {err && <p className="sheet-error" style={{ marginTop: 16 }}>{err}</p>}
        {res && (
          <div className="mine" style={{ marginTop: 16 }}>
            <b>Sent.</b>
            <div className="line"><span>Funded account</span><code>{res.ss58}</code></div>
            <div className="line"><span>Contracts see it as</span><code>{res.h160}</code></div>
            {res.viaEvm && <p style={{ fontSize: 14 }}>The recipient was resolved to its native account. Check the funded account above.</p>}
            {backend?.mode === 'live' && res.block && <a href={explorerBlock(res.block)} target="_blank" rel="noreferrer">View block {res.block.toLocaleString()}</a>}
          </div>
        )}
      </div>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Why two addresses?</h2>
        <p className="note" style={{ marginTop: 10, color: 'var(--ink-2)' }}>
          Portaldot V3 accounts are Substrate accounts. Solidity sees each one as a 20-byte address derived from it, and an Ethereum key maps to its own Substrate account.
          This service resolves the recipient before sending. Always check the funded account in the result.
        </p>
        <dl className="kv" style={{ marginTop: 20 }}>
          <dt>Network</dt><dd>Portaldot V3 Testnet</dd>
          <dt>Chain ID</dt><dd>420420777</dd>
          <dt>EVM RPC</dt><dd className="mono">test-evm-rpc-v3.portaldot.dev</dd>
          <dt>Token</dt><dd>tPOT, 14 decimals</dd>
          {status && <><dt>Cooldown</dt><dd>{Math.round(status.cooldownSeconds / 3600)} h per account</dd><dt>Left today</dt><dd>{status.remainingToday} requests</dd></>}
        </dl>
        <h3 style={{ fontSize: 16, marginTop: 24 }}>From a script</h3>
        <pre className="notice mono" style={{ overflow: 'auto' }}>{`curl -X POST ${location.origin}/api/drip \\\n  -H 'content-type: application/json' \\\n  -d '{"address":"0xYourAddress"}'`}</pre>
        <p style={{ marginTop: 8 }}><CopyButton text={`curl -X POST ${location.origin}/api/drip -H 'content-type: application/json' -d '{"address":"0xYourAddress"}'`} label="Copy command" /></p>
      </div>
    </div>
  );
}
