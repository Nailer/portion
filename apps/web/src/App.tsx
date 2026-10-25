import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrandMark, Icon } from './components/Icon';
import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useApp } from './state/app';
import { usePassport } from './state/passport';
import { useRunner } from './state/runner';
import { PassportDialog } from './components/PassportDialog';
import { Spinner, CopyButton } from './components/ui';
import { pot, usd, short } from './lib/format';
import { Home } from './pages/Home';
const ListingPage = lazy(() => import('./pages/Listing').then(module => ({ default: module.ListingPage })));
const Create = lazy(() => import('./pages/Create').then(module => ({ default: module.Create })));
const Portfolio = lazy(() => import('./pages/Portfolio').then(module => ({ default: module.Portfolio })));
const Network = lazy(() => import('./pages/Network').then(module => ({ default: module.Network })));
const Pools = lazy(() => import('./pages/Pools').then(module => ({ default: module.Pools })));
const Faucet = lazy(() => import('./pages/Faucet').then(module => ({ default: module.Faucet })));
const Teleport = lazy(() => import('./pages/Teleport').then(module => ({ default: module.Teleport })));
const Guide = lazy(() => import('./pages/Guide').then(module => ({ default: module.Guide })));
const Operator = lazy(() => import('./pages/Operator').then(module => ({ default: module.Operator })));
const Business = lazy(() => import('./pages/Business').then(module => ({ default: module.Business })));
const Receipts = lazy(() => import('./pages/Receipts').then(module => ({ default: module.Receipts })));

const Logo = BrandMark;
function Unavailable() { return <div className="market-empty"><h1>Funding is unavailable for this connection.</h1><p>A configured funding contract could not be verified. Inspect the network status before using listings, purchases, payments or claims.</p><Link className="btn primary" to="/network">View the real network</Link><Link className="btn ghost" to="/guide">See the development stages</Link></div>; }

function AccountChip() {
  const { passport, balances, signOut, loading } = usePassport();
  const { openPassport } = useRunner();
  const [open, setOpen] = useState(false);
  if (loading) return null;
  if (!passport) return <button className="btn dark sm" onClick={openPassport}>Connect wallet <Icon name="arrow" size={16}/></button>;
  return (
    <>
      <button className="chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="avatar" />
        <span>{balances ? pot(balances.pot, 2) : 'Balance unavailable'}</span>
        <small>{short(passport.address, 4, 4)}</small>
      </button>
      {open && (
        <div className="account-menu" role="dialog" aria-label="Your account">
          <div className="account-heading"><span className="choice-symbol"><Icon name="wallet"/></span><div><strong>Connected wallet</strong><small>Keys remain in your wallet</small></div><button className="dialog-close" aria-label="Close account menu" onClick={() => setOpen(false)}><Icon name="close" size={16}/></button></div>
          <div className="account-balance"><small>Payment token balance</small><b>{balances ? usd(balances.pusd) : 'Unavailable'}</b><span>{balances ? `${pot(balances.pot, 2)} free native balance` : 'Native balance unavailable'}</span><small>Read from Portaldot · refreshed every 15 seconds</small></div>
          <details className="account-details"><summary>Account details</summary><dl>
            <dt>Network account</dt><dd className="mono">{passport.address} <CopyButton text={passport.address} /></dd>
            <dt>Contract address</dt><dd className="mono">{passport.h160} <CopyButton text={passport.h160} /></dd>
          </dl></details>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost sm" onClick={() => { setOpen(false); openPassport(); }}>Switch account</button>
            <Link className="btn ghost sm" to="/faucet" onClick={() => setOpen(false)}>Get tokens</Link>
            <button className="btn ghost sm" onClick={() => { signOut(); setOpen(false); }}>Sign out</button>
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  const { status, error, backend, reconnect } = useApp();
  const [navOpen, setNavOpen] = useState(false);
  const loc = useLocation();
  const tools = useRef<HTMLDetailsElement>(null);
  const close = () => { setNavOpen(false); if (tools.current) tools.current.open = false; };
  useEffect(() => { close(); }, [loc.pathname]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (tools.current && !tools.current.contains(event.target as Node)) tools.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && tools.current?.open) { tools.current.open = false; tools.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, []);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link to="/" className="brand" onClick={close}><Logo />Portion</Link>
          <nav className={`nav${navOpen ? ' open' : ''}`} aria-label="Main">
            <NavLink to="/" end onClick={close}>Explore</NavLink>
            <NavLink to="/create" onClick={close}>Raise funds</NavLink>
            <NavLink to="/portfolio" onClick={close}>Portfolio</NavLink>
            <NavLink to="/operator" onClick={close}>Workspace</NavLink>
            <NavLink to="/guide" onClick={close}>How it works</NavLink>
            <details ref={tools} className="tools-nav"><summary>Tools <span>⌄</span></summary><div className="tools-menu">
              <NavLink to="/business" onClick={close}>Revenue model</NavLink>
              <NavLink to="/network" onClick={close}>Network console</NavLink>
              <NavLink to="/receipts" onClick={close}>Receipt centre</NavLink>
              <NavLink to="/pools" onClick={close}>Staking pools</NavLink>
              <NavLink to="/teleport" onClick={close}>Teleport bridge</NavLink>
              <NavLink to="/faucet" onClick={close}>Testnet faucet</NavLink>
            </div></details>
          </nav>
          <div className="spacer" />
          <span className="network-chip"><i className="live-indicator" />{status === 'ready' ? 'Testnet connected' : status === 'connecting' ? 'Connecting' : 'Offline'}</span>
          <AccountChip />
          <button className="btn ghost sm menu-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Menu" aria-expanded={navOpen}>Menu</button>
        </div>
      </header>

      {backend?.mode === 'live' && !backend.deployed && (
        <div className="banner" role="status"><div className="wrap"><b>Funding contract unavailable.</b> <span>The current connection has no verified funding contract.</span></div></div>
      )}

      <main className="wrap page" key={loc.pathname}>
        {!['/', '/business', '/guide', '/receipts'].includes(loc.pathname) && status === 'connecting' && <div className="empty"><Spinner /><h3>Connecting to Portaldot V3…</h3><p>Opening a connection to the testnet.</p></div>}
        {!['/', '/business', '/guide', '/receipts'].includes(loc.pathname) && status === 'offline' && (
          <div className="empty">
            <h3>The Portaldot testnet is not answering</h3>
            <p>{error}. Live data is unavailable. No balances or activity will be invented.</p>
            <button className="btn primary" onClick={reconnect}>Retry connection</button>
          </div>
        )}
        {(['/', '/business', '/guide', '/receipts'].includes(loc.pathname) || (status === 'ready' && backend)) && (
          <Suspense fallback={<div className="empty"><Spinner label="Loading page"/></div>}><Routes>
            <Route path="/" element={<Home />} />
            <Route path="/listing/:id" element={backend?.deployed ? <ListingPage /> : <Unavailable />} />
            <Route path="/create" element={backend?.deployed ? <Create /> : <Unavailable />} />
            <Route path="/portfolio" element={backend?.deployed ? <Portfolio /> : <Unavailable />} />
            <Route path="/operator" element={backend?.deployed ? <Operator /> : <Unavailable />} />
            <Route path="/network" element={<Network />} />
            <Route path="/pools" element={<Pools />} />
            <Route path="/faucet" element={<Faucet />} />
            <Route path="/teleport" element={<Teleport />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/business" element={<Business />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="*" element={<div className="empty"><h3>Page not found</h3><Link className="btn primary" to="/">Back to the market</Link></div>} />
          </Routes></Suspense>
        )}
      </main>
      <PassportDialog />
      <footer className="foot">
        <div className="wrap">
          <div className="footer-brand"><Link className="brand" to="/"><Logo />Portion</Link><p>Working assets. Shared ambition.</p><small>Built on Portaldot V3 · Test tokens only. No monetary value.</small></div>
          <span><Link to="/guide">How it works</Link> · <Link to="/faucet">Faucet</Link> · <Link to="/business">Revenue model</Link></span>
        </div>
      </footer>
    </>
  );
}
