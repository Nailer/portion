import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { usePassport } from '../state/passport';
import { api } from '../lib/backend';
import { useAsync, CopyButton } from './ui';
import { pot, usd, short } from '../lib/format';

export function Readiness() {
  const { backend, status, tick } = useApp(); const { passport, balances } = usePassport();
  const { data: service, loading, error } = useAsync(() => api<{ok:boolean;documents?:boolean;indexedHistoryComplete?:boolean}>('/api/health',{signal:AbortSignal.timeout(5000)}),[tick]);
  return <section className="readiness-section" aria-label="Account and service readiness"><h2>Before you act</h2><div className="readiness-grid">
    <article><span className="eyebrow">YOUR ACCOUNT</span><h3>{passport ? short(passport.address) : 'No account selected'}</h3><p>{passport ? <>Native account shared by your wallet. <CopyButton text={passport.address}/></> : 'Browse public records without connecting. Creating, buying and claiming require your wallet approval.'}</p></article>
    <article><span className="eyebrow">LIVE BALANCES</span><h3>{!passport ? 'Connect to read' : !balances ? 'Balance unavailable' : pot(balances.pot,6)}</h3><p>{balances ? <>Free native balance for fees and storage; locks can reduce spendable funds. Payment balance: <b>{usd(balances.pusd,6)}</b>.</> : 'No opening balance is assigned or assumed.'}</p>{passport && balances && (balances.pot === 0n || balances.pusd === 0n) && <Link to="/faucet">Check which test token you need →</Link>}</article>
    <article><span className="eyebrow">CHAIN AND CONTRACT</span><h3>{status === 'connecting' ? 'Checking network' : status === 'offline' ? 'Network unavailable' : backend?.deployed ? 'Contract verified' : 'Contract unavailable'}</h3><p>Portaldot testnet. Transactions require the expected network, runtime bytecode and configured payment asset. Readiness does not verify the physical equipment.</p></article>
    <article><span className="eyebrow">PUBLIC DOCUMENTS AND RECEIPTS</span><h3>{loading ? 'Checking services' : service?.ok && service.documents ? 'Public copies available' : 'Service unavailable'}</h3><p>{error ? 'Public services could not be checked. Chain balances and local receipts are separate readings.' : 'Receipt coverage is partial. A connected wallet does not imply available credits, complete history or affordable storage deposits.'}</p><Link to="/receipts">Keep and reconcile receipts →</Link></article>
  </div></section>;
}
