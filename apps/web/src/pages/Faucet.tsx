import { useState } from 'react';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { pot, usd } from '../lib/format';
import { api, type DripResult } from '../lib/backend';
import { CopyButton, useAsync } from '../components/ui';
import { explorerBlock } from '../lib/format';
import { useRunner } from '../state/runner';

interface FaucetStatus { address: string; balance: string; dripPot: string; dripPusd: string; cooldownSeconds: number; remainingToday: number; pending?: boolean; reset?: string }

export function Faucet() {
  const { backend, refresh } = useApp();
  const { passport } = usePassport();
  const { openPassport } = useRunner();
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<DripResult>();
  const [err, setErr] = useState<string>();
  const { data: status, error: statusError } = useAsync(() => api<FaucetStatus>('/api/faucet'), [backend]);

  const target = addr.trim() || passport?.address || '';
  const go = async () => {
    setBusy(true); setErr(undefined); setRes(undefined);
    try { if(!passport) throw new Error('Connect the recipient wallet first.'); setRes(await backend!.drip(target,passport)); refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="two-col" style={{ alignItems: 'start' }}>
      <div>
        <h1 className="page-title">Testnet faucet</h1>
        <p className="page-lede">Request real pUSD test credits for bonds and purchases. This service does not send native tPOT: obtain that from the official Portaldot testnet faucet to pay fees and storage deposits. Test credits have no monetary value.</p>
        <p className="notice">Your wallet approves a readable message proving this recipient is yours. This message costs no gas and authorizes only today’s test-credit request. Portion never asks for your private key.</p>{!passport && <button className="btn ghost" onClick={openPassport}>Connect recipient wallet</button>}
        <div className="field" style={{ marginTop: 28 }}>
          <label htmlFor="addr">Address</label>
          <input id="addr" type="text" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={passport ? `${passport.address} (your account)` : 'Native public address (5…)'} spellCheck={false} />
          <p className="hint">Only public addresses belong here. Never enter a recovery phrase or private key.</p>
        </div>
        <button className="btn primary" disabled={busy || !passport || !target || !status || status.pending || status.remainingToday === 0} onClick={go}>{busy ? 'Awaiting approval / checking issuance…' : !status ? 'Live faucet unavailable' : status.pending ? 'Issuer awaiting reconciliation' : status.remainingToday === 0 ? 'Daily attempt limit reached' : `Request ${usd(status.dripPusd)} test credits`}</button>
        <p className="hint">One reserved attempt per native account per UTC day; at most 20 attempts globally. Failed or interrupted attempts may consume the reservation. An unconfirmed mint pauses issuance until reconciled.</p>
        {statusError && <p className="sheet-error" role="alert">Test-credit availability could not be checked: {statusError.message}</p>}
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
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Which address should I use?</h2>
        <p className="note" style={{ marginTop: 10, color: 'var(--ink-2)' }}>
          Use the native public address shared by Portaldot Wallet. Solidity also sees a derived 20-byte contract address, but this credit service accepts the native address. Ordinary MetaMask EVM accounts cannot sign the native asset workflow.
        </p>
        <dl className="kv" style={{ marginTop: 20 }}>
          <dt>Network</dt><dd>Portaldot V3 Testnet</dd>
          <dt>Chain ID</dt><dd>420420777</dd>
          <dt>EVM RPC</dt><dd className="mono">test-evm-rpc-v3.portaldot.dev</dd>
          <dt>Token</dt><dd>tPOT, 14 decimals</dd>
          {status && <><dt>Cooldown</dt><dd>{Math.round(status.cooldownSeconds / 3600)} h per account</dd><dt>Left today</dt><dd>{status.remainingToday} requests</dd></>}
        </dl>
        <h3 style={{ fontSize: 16, marginTop: 24 }}>From a script</h3><p className="note">First fetch /api/faucet/challenge?address=YOUR_NATIVE_PUBLIC_ADDRESS and sign that exact readable message with the recipient wallet. Never put a private key in a curl command.</p>
        <pre className="notice mono" style={{ overflow: 'auto' }}>{`curl -X POST ${location.origin}/api/drip \\\n  -H 'content-type: application/json' \\\n  -d '{"address":"YOUR_NATIVE_PUBLIC_ADDRESS","signature":"WALLET_SIGNATURE_FOR_CURRENT_CHALLENGE"}'`}</pre>
        <p style={{ marginTop: 8 }}><CopyButton text={`curl -X POST ${location.origin}/api/drip -H 'content-type: application/json' -d '{"address":"YOUR_NATIVE_PUBLIC_ADDRESS","signature":"WALLET_SIGNATURE_FOR_CURRENT_CHALLENGE"}'`} label="Copy command" /></p>
      </div>
    </div>
  );
}
