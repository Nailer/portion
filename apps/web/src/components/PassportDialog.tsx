import { useEffect, useState } from 'react';
import { useRunner } from '../state/runner';
import { usePassport } from '../state/passport';
import { useApp } from '../state/app';
import { installedWallets, walletLabel, orderedWallets, isPortaldotWallet, PORTALDOT_WALLET_URL } from '../lib/wallet';
import { short } from '../lib/format';
import { Dialog } from './Dialog';
import { BrandMark, Icon } from './Icon';

export function PassportDialog() {
  const { passportOpen, passportReason, closePassport } = useRunner();
  const { requestConnection, selectAccount, walletAccounts } = usePassport();
  const { refresh, backend } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [choosing, setChoosing] = useState(false);
  useEffect(() => { if (passportOpen) { setProviders(orderedWallets(installedWallets())); setError(''); setChoosing(false); } }, [passportOpen]);
  if (!passportOpen) return null;
  const connect = async (provider: string) => {
    setBusy(true); setError('');
    try { await requestConnection(provider); setChoosing(true); } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };
  const choose = (address: string) => {
    try { selectAccount(address); refresh(); closePassport({ connected: true }); } catch (err) { setError((err as Error).message); }
  };
  const personas = backend?.sandbox?.personas;
  if (personas) return <Dialog onClose={() => closePassport()} labelledBy="pp-title" className="auth-dialog" focusKey="sandbox">
    <aside className="auth-story">
      <div className="auth-brand"><BrandMark/><span>Portion</span></div>
      <span className="eyebrow">SANDBOX</span>
      <h2>Play every role.</h2>
      <p>These are labelled sandbox accounts with pretend money. They have no keys, and nothing they do reaches Portaldot.</p>
      <div className="auth-security"><Icon name="shield" size={22}/><span>To use a real wallet, exit the sandbox.<br/><b>Portion never asks for your recovery phrase.</b></span></div>
    </aside>
    <section className="auth-options">
      <button className="dialog-close" aria-label="Close role picker" onClick={() => closePassport()}><Icon name="close"/></button>
      <span className="eyebrow">CHOOSE A ROLE</span>
      <h2 id="pp-title">Who are you acting as?</h2>
      {passportReason && <p className="auth-reason" role="status">{passportReason}</p>}
      <div className="wallet-accounts">{personas.map(p => <button className="auth-choice" key={p.key} onClick={() => choose(p.key)}><span className="choice-symbol"><Icon name="wallet"/></span><span><b>{p.label}</b><small>{p.role}</small></span><Icon name="arrow"/></button>)}</div>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </section>
  </Dialog>;
  return <Dialog onClose={() => closePassport()} labelledBy="pp-title" className="auth-dialog" closeDisabled={busy} focusKey={choosing ? 'accounts' : 'welcome'}>
    <aside className="auth-story">
      <div className="auth-brand"><BrandMark/><span>Portion</span></div>
      <div className="auth-orbit" aria-hidden="true"><i/><i/><i/><span><Icon name="layers" size={48}/></span><b className="orbit-dot one"/><b className="orbit-dot two"/></div>
      <span className="eyebrow">TEST NETWORK</span>
      <h2>You approve every step.</h2>
      <p>Portion reads your account and balances. Nothing is signed until you review a transaction and approve it in your wallet.</p>
      <div className="auth-security"><Icon name="shield" size={22}/><span>Your keys stay in your wallet.<br/><b>We never ask for your recovery phrase.</b></span></div>
    </aside>
    <section className="auth-options">
      <button className="dialog-close" aria-label="Close account dialog" disabled={busy} onClick={() => closePassport()}><Icon name="close"/></button>
      <span className="eyebrow">CONNECT A WALLET</span>
      <h2 id="pp-title">{choosing ? 'Choose your account.' : 'Connect your wallet.'}</h2>
      {passportReason && <p className="auth-reason" role="status">{passportReason}</p>}
      <p className="auth-intro">{choosing ? 'Only accounts shared by your wallet appear here. Transactions are approved inside your wallet.' : 'Connect an existing browser wallet. Portion does not create accounts or grant balances.'}</p>
      {choosing ? <div className="wallet-accounts">{walletAccounts.map(account => <button className="auth-choice" key={account.address} disabled={busy} onClick={() => choose(account.address)}><span className="choice-symbol"><Icon name="wallet"/></span><span><b>{account.name || 'Wallet account'}</b><small>{short(account.address, 10, 8)}</small></span><Icon name="arrow"/></button>)}<button className="link-btn" onClick={() => setChoosing(false)}>← Other ways to explore</button></div> : <>
        <div className="auth-section-label wallet-label"><span>CONNECT TO PORTALDOT</span><Icon name="lock" size={14}/></div>
        {!providers.some(isPortaldotWallet) && <a className="auth-choice featured" href={PORTALDOT_WALLET_URL} target="_blank" rel="noreferrer"><span className="choice-symbol"><Icon name="wallet"/></span><span><b>Portaldot Wallet</b><small>Get the official extension, then reload Portion to connect.</small></span><Icon name="external"/></a>}
        {providers.length ? providers.map(provider => <button className={`auth-choice wallet-choice${isPortaldotWallet(provider) ? ' featured' : ''}`} key={provider} disabled={busy} onClick={() => void connect(provider)}><span className="choice-symbol"><Icon name="wallet"/></span><span><b>{walletLabel(provider)}</b><small>Approve access and signing in your wallet.</small></span><span className="wallet-detected">Detected</span></button>) : <div className="wallet-unavailable"><Icon name="wallet"/><div><b>No compatible wallet detected</b><p>Install Portaldot Wallet using the link above. Other compatible native wallets, including Talisman, SubWallet and Polkadot.js, also appear here when detected. You can browse without connecting.</p></div></div>}
      </>}
      {busy && <p className="auth-progress" role="status">Approve the connection in your wallet…</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p className="auth-footnote"><Icon name="shield" size={14}/><span>We never ask for your recovery phrase.<br/>Testnet only. Connecting does not approve a transaction.</span></p>
    </section>
  </Dialog>;
}
