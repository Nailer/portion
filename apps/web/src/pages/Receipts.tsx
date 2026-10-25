import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePassport } from '../state/passport';
import { useApp } from '../state/app';
import { api } from '../lib/backend';
import { readReceipts, recordReconciledOutcome, type JournalReceipt } from '../lib/receipt-journal';
import { walletAddress } from '../lib/wallet';
import { CopyButton } from '../components/ui';
import { explorerBlock } from '../lib/format';

export function Receipts() {
  const { passport } = usePassport(); const { refresh } = useApp();
  const [rows, setRows] = useState<JournalReceipt[]>([]);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const [hash, setHash] = useState(''); const [block, setBlock] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => { try { setRows(readReceipts(localStorage)); } catch (e) { setError((e as Error).message); } };
  useEffect(load, []);
  const mine = rows.filter(row => row.owner === passport?.address);
  const check = async (publish: boolean) => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (!/^0x[0-9a-f]{64}$/i.test(hash.trim()) || !Number.isSafeInteger(Number(block)) || Number(block) < 1) throw new Error('Enter the full transaction hash and its actual block number.');
      const result = await api<{ finalized: boolean; ok: boolean; signer: string | null; error?: string }>(`/api/transactions/${hash.trim()}?block=${block}`);
      if (!result.finalized) throw new Error('Finalization has not been verified.');
      if (passport && result.signer && walletAddress(result.signer) === passport.address) recordReconciledOutcome(localStorage, passport.address, hash.trim(), Number(block), result.ok);
      if (publish && result.ok) await api('/api/receipts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ txHash: hash.trim(), block: Number(block) }) });
      setMessage(result.ok ? publish ? 'Finalized transaction verified and Portion receipt published. No payment was submitted again.' : 'Successful finalization verified. You can publish its Portion events if this was a contract action.' : `Finalized failure verified: ${result.error ?? 'Dispatch failed'}. Review the cause before preparing a new action.`);
      load(); refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="console"><span className="eyebrow">KEEP THE EVIDENCE</span><h1>Your receipt centre.</h1><p className="page-lede">Keep finalized hashes, check an uncertain outcome and publish a missing receipt. These checks never repeat a purchase or submit another chain transaction.</p>
    <p className="notice">Local records are saved on this browser profile, with public account addresses and hashes only. They are not a complete history or an independent source of truth. Changing devices will not bring these records with you.</p>
    <section className="two-col"><div><h2>Check a transaction</h2><label htmlFor="receipt-hash">Transaction hash</label><input id="receipt-hash" value={hash} onChange={e => setHash(e.target.value)} placeholder="0x…" spellCheck={false}/><label htmlFor="receipt-block">Actual block number</label><input id="receipt-block" value={block} inputMode="numeric" onChange={e => setBlock(e.target.value)}/><p className="hint">Find the block in the network explorer or wallet history. A missing match in one block does not prove the transaction failed.</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn primary" disabled={busy} onClick={() => void check(false)}>Check finalized outcome</button><button className="btn ghost" disabled={busy} onClick={() => void check(true)}>Verify and publish receipt</button></div>{busy && <p role="status">Checking finalized chain records…</p>}{message && <p className="notice" role="status">{message}</p>}{error && <p className="sheet-error" role="alert">{error}</p>}</div>
    <div><h2>Records on this browser</h2>{!passport ? <p>Connect your wallet to filter local records for your account. Public transaction verification works without connecting.</p> : !mine.length ? <p>No local receipts for this account yet. This does not mean the account has no chain activity.</p> : mine.map(row => <article className="market-empty" key={row.id}><span className="eyebrow">{row.status === 'unconfirmed' ? 'OUTCOME UNKNOWN — CHECK BEFORE RETRYING' : row.status === 'reconciled' ? 'LAST TRANSACTION VERIFIED — CHECK ANY REMAINING STEPS' : row.status === 'finalized' ? 'FINALIZED' : 'ACTION FAILED — EARLIER STEPS MAY HAVE FINALIZED'}</span><h3>{row.title}</h3><small>Recorded {new Date(row.recordedAt).toLocaleString()}</small>{row.warning && <p>{row.warning}</p>}{row.txs.map(tx => <p key={tx.hash}><b>{tx.label}</b><br/><code style={{ overflowWrap: 'anywhere' }}>{tx.hash}</code> <CopyButton text={tx.hash}/>{tx.block && <> · <a href={explorerBlock(tx.block)} target="_blank" rel="noreferrer">Block {tx.block}</a></>} <button className="link-btn" onClick={() => { setHash(tx.hash); setBlock(tx.block?.toString() ?? ''); }}>Check this receipt</button></p>)}{!row.txs.length && <p>No hash was returned. Inspect your wallet history before retrying.</p>}</article>)}<Link to="/network">Open network evidence →</Link></div></section>
  </div>;
}
