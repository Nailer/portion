import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRunner } from '../state/runner';
import { usePassport } from '../state/passport';
import { useApp } from '../state/app';
import { installedWallets, walletLabel } from '../lib/wallet';
import { short } from '../lib/format';
import { Dialog } from './Dialog';
import { BrandMark, Icon } from './Icon';

export function PassportDialog() {
  const navigate = useNavigate();
  const { passportOpen, closePassport } = useRunner();
  const { switchDemoRole, requestConnection, selectAccount, walletAccounts } = usePassport();
  const { backend, forceDemo, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [pendingRole, setPendingRole] = useState<'operator' | 'funder' | null>(null);

  useEffect(() => { if (passportOpen) { setProviders(Object.keys(installedWallets())); setError(''); setChoosing(false); } }, [passportOpen]);
  useEffect(() => {
    if (!pendingRole || backend?.mode !== 'demo') return;
    let active = true;
    switchDemoRole(pendingRole).then(() => { if (active) { navigate(pendingRole === 'operator' ? '/operator' : '/'); setPendingRole(null); setBusy(false); closePassport(); } }, err => { if (active) { setError((err as Error).message); setPendingRole(null); setBusy(false); } });
    return () => { active = false; };
  }, [pendingRole, backend]);
  if (!passportOpen) return null;
  const demo = (role: 'operator' | 'funder') => {
    setBusy(true); setError(''); setPendingRole(role);
    if (backend?.mode !== 'demo') forceDemo(true);
  };
  const connect = async (provider: string) => {
    setBusy(true); setError('');
    try { await requestConnection(provider); setChoosing(true); } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const choose = (address: string) => {
    try { selectAccount(address); forceDemo(false); refresh(); closePassport(); } catch (err) { setError((err as Error).message); }
  };
  return <Dialog onClose={closePassport} labelledBy="pp-title" className="auth-dialog" closeDisabled={busy} focusKey={choosing ? 'accounts' : 'welcome'}>
    <aside className="auth-story">
      <div className="auth-brand"><BrandMark/><span>Portion</span></div>
      <div className="auth-orbit" aria-hidden="true"><i/><i/><i/><span><Icon name="layers" size={48}/></span><b className="orbit-dot one"/><b className="orbit-dot two"/></div>
      <span className="eyebrow">YOUR NEXT PERSPECTIVE</span>
      <h2>Good things.<br/>Built together.</h2>
      <p>Explore working assets. Understand the terms. Follow every payment.</p>
      <div className="auth-security"><Icon name="shield" size={22}/><span>Your keys stay in your wallet.<br/><b>We never ask for your recovery phrase.</b></span></div>
    </aside>
    <section className="auth-options">
      <button className="dialog-close" aria-label="Close account dialog" disabled={busy} onClick={closePassport}><Icon name="close"/></button>
      <span className="eyebrow">WELCOME TO PORTION</span>
      <h2 id="pp-title">{choosing ? 'Choose your account.' : 'Find your place.'}</h2>
      <p className="auth-intro">{choosing ? 'Only accounts shared by your wallet appear here. Transactions are approved inside your wallet.' : 'Try the full experience with demo funds, or connect a browser wallet for live testnet tools.'}</p>
      {choosing ? <div className="wallet-accounts">{walletAccounts.map(account => <button className="auth-choice" key={account.address} disabled={busy} onClick={() => choose(account.address)}><span className="choice-symbol"><Icon name="wallet"/></span><span><b>{account.name || 'Wallet account'}</b><small>{short(account.address, 10, 8)}</small></span><Icon name="arrow"/></button>)}<button className="link-btn" onClick={() => setChoosing(false)}>← Other ways to explore</button></div> : <>
        <div className="auth-section-label"><span>EXPLORE THE DEMO</span><small>No wallet needed</small></div>
        <button className="auth-choice featured" disabled={busy} onClick={() => demo('funder')}><span className="choice-symbol"><Icon name="layers"/></span><span><b>Explore as a funder</b><small>Find an asset. Try buying shares and claiming income.</small></span><Icon name="arrow"/></button>
        <button className="auth-choice" disabled={busy} onClick={() => demo('operator')}><span className="choice-symbol"><Icon name="building"/></span><span><b>Try the operator workspace</b><small>List an asset. Manage funding and revenue payments.</small></span><Icon name="arrow"/></button>
        <div className="auth-section-label wallet-label"><span>CONNECT A BROWSER WALLET</span><Icon name="lock" size={14}/></div>
        {providers.length ? providers.map(provider => <button className="auth-choice wallet-choice" key={provider} disabled={busy} onClick={() => void connect(provider)}><span className="choice-symbol"><Icon name="wallet"/></span><span><b>{walletLabel(provider)}</b><small>Approve access and signing in your wallet.</small></span><span className="wallet-detected">Detected</span></button>) : <div className="wallet-unavailable"><Icon name="wallet"/><div><b>No compatible wallet detected</b><p>Use a Substrate-compatible wallet in your browser. The demo works without one.</p><a href="https://polkadot.js.org/extension/" target="_blank" rel="noreferrer">View wallet options <Icon name="external" size={12}/></a></div></div>}
      </>}
      {busy && <p className="auth-progress" role="status">{pendingRole ? 'Preparing your demo workspace…' : 'Approve the connection in your wallet…'}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="auth-footnote"><Icon name="shield" size={14}/><span>We never ask for your recovery phrase.<br/>Demo funds have no value. Live asset funding is not available yet.</span></p>
    </section>
  </Dialog>;
}
