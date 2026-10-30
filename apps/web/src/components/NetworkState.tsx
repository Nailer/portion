import { Link } from 'react-router-dom';
import { useApp } from '../state/app';
import { Spinner } from './ui';

/** The one way any page says the chain is unavailable. No substitute data is ever shown, and nothing falls back to the sandbox. */
export function NetworkState({ what }: { what: string }) {
  const { status, error, reconnect, sandbox, backend } = useApp();
  if (status === 'connecting') return <div className="pv-state" role="status"><Spinner/><h3>{sandbox ? 'Starting the sandbox' : 'Connecting to Portaldot'}</h3><p>{sandbox ? 'Loading Core v2 into this browser.' : `Reading ${what} from the test network. The public endpoint often takes 10 seconds or more.`}</p></div>;
  if (status === 'offline') return <div className="pv-state" role="alert"><h3>{sandbox ? 'The sandbox could not start' : 'The test network isn’t answering'}</h3><p>{error ? `${error.replace(/\.$/, '')}. ` : ''}We can’t read {what} right now, and we won’t show substitute data. Nothing was submitted.</p><div className="pv-actions" style={{ marginTop: 0 }}><button className="btn primary" onClick={reconnect}>Retry connection</button>{!sandbox && <Link className="btn ghost" to="/evidence">See recorded evidence</Link>}</div></div>;
  if (!backend?.deployed) return <div className="pv-state" role="alert"><h3>The funding contract couldn’t be verified</h3><p>We can’t read {what} on this connection. Listings, purchases and claims stay off until it is verified.</p><div className="pv-actions" style={{ marginTop: 0 }}><button className="btn primary" onClick={reconnect}>Retry connection</button><Link className="btn ghost" to="/network">Network console</Link></div></div>;
  return null;
}
