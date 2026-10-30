import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrandMark, Icon } from './components/Icon';
import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useApp } from './state/app';
import { usePassport } from './state/passport';
import { useRunner } from './state/runner';
import { PassportDialog } from './components/PassportDialog';
import { Spinner, CopyButton } from './components/ui';
import { pot, usd, short } from './lib/format';
import { useRouteScroll } from './lib/scroll';
import { Home } from './pages/Home';
import { SandboxBar } from './components/SandboxBar';
import { ThemeChoices, ThemeMenu } from './components/ThemeSwitch';
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
const Evidence = lazy(() => import('./pages/Evidence').then(module => ({ default: module.Evidence })));
const Assets = lazy(() => import('./pages/Assets').then(module => ({ default: module.Assets })));
const Sandbox = lazy(() => import('./pages/Sandbox').then(module => ({ default: module.Sandbox })));

const Logo = BrandMark;
// Pages that work, or explain themselves, while the chain is unreachable. Each one handles a missing connection itself.
const PUBLIC_PATHS = ['/', '/assets', '/create', '/portfolio', '/operator', '/business', '/guide', '/receipts', '/evidence', '/sandbox'];
// Pages that read or prove the real Portaldot testnet. In the sandbox they would mislead, so they say so instead.
const LIVE_ONLY = ['/network', '/pools', '/teleport', '/receipts', '/evidence'];
function LiveOnly() {
  const { exitSandbox } = useApp();
  return <div className="market-empty"><span className="eyebrow">SANDBOX</span><h1>This page shows the real Portaldot testnet.</h1><p>You are in the sandbox, where everything is simulated in this browser. Exit the sandbox to see real contracts, transactions and receipts.</p><button className="btn primary" onClick={exitSandbox}>Exit the sandbox</button><Link className="btn ghost" to="/sandbox">Back to the demo guide</Link></div>;
}
function Unavailable() { return <div className="market-empty"><h1>Funding is unavailable for this connection.</h1><p>A configured funding contract could not be verified. Inspect the network status before using listings, purchases, payments or claims.</p><Link className="btn primary" to="/network">View the real network</Link><Link className="btn ghost" to="/guide">See the development stages</Link></div>; }

function AccountChip() {
  const { passport, balances, signOut, loading } = usePassport();
  const { openPassport } = useRunner();
  const { backend } = useApp();
  const [open, setOpen] = useState(false);
  if (loading) return null;
  const persona = backend?.sandbox?.personas.find(p => p.passport === passport);
  if (backend?.sandbox) return <button className="chip" onClick={() => openPassport()} aria-label="Change sandbox role"><span className="avatar" /><span>{persona?.label ?? 'Choose a role'}</span><small>{balances?.pusd != null ? usd(balances.pusd, 0) : ''}</small></button>;
  if (!passport) return <button className="btn dark sm connect-btn" onClick={() => openPassport()}>Connect<span>{' wallet'}</span></button>;
  return (
    <>
      <button className="chip" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Connected wallet ${short(passport.address, 4, 4)}. Open account menu.`}>
        <span className="avatar" />
        <small>{short(passport.address, 4, 4)}</small>
      </button>
      {open && (
        <div className="account-menu" role="dialog" aria-label="Your account">
          <div className="account-heading"><span className="choice-symbol"><Icon name="wallet"/></span><div><strong>Connected wallet</strong><small>{short(passport.address, 6, 6)} · keys stay in your wallet</small></div><button className="dialog-close" aria-label="Close account menu" onClick={() => setOpen(false)}><Icon name="close" size={16}/></button></div>
          <div className="account-balance"><small>Payment token balance</small><b>{balances ? usd(balances.pusd) : 'Unavailable'}</b><span>{balances ? `${pot(balances.pot, 2)} free native balance` : 'Native balance unavailable'}</span><small>Read from Portaldot · refreshed every 15 seconds</small></div>
          <details className="account-details"><summary>Account details</summary><dl>
            <dt>Network account</dt><dd className="mono">{passport.address} <CopyButton text={passport.address} /></dd>
            <dt>Contract address</dt><dd className="mono">{passport.h160} <CopyButton text={passport.h160} /></dd>
          </dl></details>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost sm" onClick={() => { setOpen(false); openPassport(); }}>Switch account</button>
            <Link className="btn ghost sm" to="/faucet" onClick={() => setOpen(false)}>Get test tokens</Link>
            <button className="btn ghost sm" onClick={() => { signOut(); setOpen(false); }}>Disconnect</button>
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  const { status, error, backend, reconnect, sandbox } = useApp();
  const [navOpen, setNavOpen] = useState(false);
  const loc = useLocation();
  useRouteScroll('main');
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
      <a className="skip-link" href="#main">Skip to content</a>
      {sandbox ? <SandboxBar /> : <div className="test-strip" role="note"><div className="wrap"><i className="dot" aria-hidden="true"/><span><b>Test network preview.</b> Tokens have no monetary value and nothing here is investment advice.</span><Link to="/guide">What this means</Link></div></div>}
      <header className="top">
        <div className="wrap">
          <Link to="/" className="brand" onClick={close}><Logo />Portion</Link>
          <nav id="main-nav" className={`nav${navOpen ? ' open' : ''}`} aria-label="Main">
            <NavLink to="/assets" onClick={close}>Explore assets</NavLink>
            <NavLink to="/create" onClick={close}>Create an offer</NavLink>
            <NavLink to="/operator" onClick={close}>Manage offers</NavLink>
            <details ref={tools} className="tools-nav"><summary>More <span aria-hidden="true">⌄</span></summary><div className="tools-menu">
              <small>Help</small>
              <NavLink to="/guide" onClick={close}>How it works</NavLink>
              <NavLink to="/faucet" onClick={close}>Test tokens</NavLink>
              <NavLink to="/receipts" onClick={close}>My receipts</NavLink>
              <small>For reviewers</small>
              <NavLink to="/evidence" onClick={close}>Evidence record</NavLink>
              <NavLink to="/business" onClick={close}>Business model</NavLink>
              <NavLink to="/sandbox" onClick={close}>Sandbox (simulated)</NavLink>
              <small>Network tools</small>
              <NavLink to="/network" onClick={close}>Network console</NavLink>
              <NavLink to="/pools" onClick={close}>Staking pools</NavLink>
              <NavLink to="/teleport" onClick={close}>Teleport bridge</NavLink>
            </div></details>
            <ThemeChoices/>
          </nav>
          <div className="spacer" />
          <span className={`network-chip${sandbox ? ' sandbox' : ''}`}><i className="live-indicator" />{sandbox ? (status === 'ready' ? 'Sandbox · simulated' : status === 'connecting' ? 'Starting sandbox' : 'Sandbox failed') : status === 'ready' ? 'Testnet connected' : status === 'connecting' ? 'Connecting' : 'Offline'}</span>
          <ThemeMenu/>
          <NavLink to="/portfolio" className="btn ghost sm portfolio-link" onClick={close}>My portfolio</NavLink>
          <AccountChip />
          <button className="btn ghost sm menu-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Menu" aria-expanded={navOpen} aria-controls="main-nav">Menu</button>
        </div>
      </header>

      {backend?.mode === 'live' && !backend.deployed && (
        <div className="banner" role="status"><div className="wrap"><b>Funding contract unavailable.</b> <span>The current connection has no verified funding contract.</span></div></div>
      )}

      <main id="main" tabIndex={-1} className={`wrap page${loc.key === 'default' ? ' no-arrive' : ''}`} key={loc.pathname}>
        {sandbox && LIVE_ONLY.includes(loc.pathname) ? <LiveOnly /> : <>
        {!PUBLIC_PATHS.includes(loc.pathname) && status === 'connecting' && <div className="empty"><Spinner /><h3>{sandbox ? 'Starting the sandbox…' : 'Connecting to Portaldot V3…'}</h3><p>{sandbox ? 'Loading Core v2 into this browser.' : 'Opening a connection to the testnet.'}</p></div>}
        {!PUBLIC_PATHS.includes(loc.pathname) && status === 'offline' && (
          <div className="empty">
            <h3>{sandbox ? 'The sandbox could not start' : 'The Portaldot testnet is not answering'}</h3>
            <p>{error?.replace(/\.$/, '')}. {sandbox ? 'Reset the sandbox from the demo guide, or exit it.' : 'Live data is unavailable. No balances or activity will be invented.'}</p>
            <button className="btn primary" onClick={reconnect}>Retry connection</button>
          </div>
        )}
        {(PUBLIC_PATHS.includes(loc.pathname) || (status === 'ready' && backend)) && (
          <Suspense fallback={<div className="empty"><Spinner label="Loading page"/></div>}><Routes>
            <Route path="/" element={<Home />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/listing/:id" element={backend?.deployed ? <ListingPage /> : <Unavailable />} />
            <Route path="/create" element={status === 'ready' && !backend?.deployed ? <Unavailable /> : <Create />} />
            <Route path="/portfolio" element={status === 'ready' && !backend?.deployed ? <Unavailable /> : <Portfolio />} />
            <Route path="/operator" element={status === 'ready' && !backend?.deployed ? <Unavailable /> : <Operator />} />
            <Route path="/network" element={<Network />} />
            <Route path="/pools" element={<Pools />} />
            <Route path="/faucet" element={<Faucet />} />
            <Route path="/teleport" element={<Teleport />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/business" element={<Business />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/sandbox" element={<Sandbox />} />
            <Route path="*" element={<div className="empty"><h3>Page not found</h3><Link className="btn primary" to="/assets">Explore assets</Link></div>} />
          </Routes></Suspense>
        )}
        </>}
      </main>
      <PassportDialog />
      <footer className="foot">
        <div className="wrap">
          <div className="footer-brand"><Link className="brand" to="/"><Logo />Portion</Link><p>A shared record for the revenue productive assets earn.</p><small>Built on Portaldot V3 testnet. Test tokens only, no monetary value. Unaudited software; not investment, legal or tax advice.</small></div>
          <div><h4>Product</h4><ul><li><Link to="/assets">Explore assets</Link></li><li><Link to="/create">Create an offer</Link></li><li><Link to="/operator">Manage offers</Link></li><li><Link to="/portfolio">My portfolio</Link></li><li><Link to="/guide">How it works</Link></li></ul></div>
          <div><h4>Verify</h4><ul><li><Link to="/evidence">Evidence record</Link></li><li><Link to="/business">Business model</Link></li><li><Link to="/receipts">My receipts</Link></li><li><Link to="/network">Network console</Link></li><li><a href="https://github.com/Nailer/portion" target="_blank" rel="noreferrer">Source on GitHub</a></li></ul></div>
        </div>
      </footer>
    </>
  );
}
