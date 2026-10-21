import { useState } from 'react';
import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useApp } from './state/app';
import { usePassport } from './state/passport';
import { useRunner } from './state/runner';
import { PassportDialog } from './components/PassportDialog';
import { Spinner, CopyButton } from './components/ui';
import { pot, usd, short } from './lib/format';
import { Home } from './pages/Home';
import { ListingPage } from './pages/Listing';
import { Create } from './pages/Create';
import { Portfolio } from './pages/Portfolio';
import { Network } from './pages/Network';
import { Pools } from './pages/Pools';
import { Faucet } from './pages/Faucet';
import { Teleport } from './pages/Teleport';
import { Guide } from './pages/Guide';
import { Operator } from './pages/Operator';
import { DemoRoles } from './components/DemoRoles';
import { Business } from './pages/Business';

const Logo = () => (
  <svg viewBox="0 0 64 64" aria-hidden>
    <rect width="64" height="64" rx="14" fill="currentColor" />
    <path d="M32 32 L32 10 A22 22 0 1 1 10 32 Z" fill="#d7f58a" />
    <circle cx="32" cy="32" r="22" fill="none" stroke="var(--ground)" strokeWidth="3" />
  </svg>
);

function AccountChip() {
  const { passport, balances, signOut, loading } = usePassport();
  const { openPassport } = useRunner();
  const { backend } = useApp();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  if (loading) return null;
  if (!passport) return <button className="btn dark sm" onClick={openPassport}>Connect wallet <span aria-hidden="true">↗</span></button>;
  return (
    <>
      <button className="chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="avatar" />
        <span>{balances ? usd(balances.pusd, 0) : '…'}</span>
        <small>{short(passport.address, 4, 4)}</small>
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <strong>Your Passport</strong>
          <dl>
            <dt>Balance</dt><dd>{balances ? `${usd(balances.pusd)} · ${pot(balances.pot, 2)}` : '…'}</dd>
            <dt>Account</dt><dd className="mono">{passport.address} <CopyButton text={passport.address} /></dd>
            <dt>Solidity sees</dt><dd className="mono">{passport.h160} <CopyButton text={passport.h160} /></dd>
          </dl>
          <p className="notice">One key, two address worlds. Fund the account above; contracts see the second address automatically.</p>
          {passport.mnemonic && (
            <div>
              <button className="link-btn" onClick={() => setReveal((r) => !r)}>{reveal ? 'Hide recovery phrase' : 'Show recovery phrase'}</button>
              {reveal && <p className="mono" style={{ marginTop: 8, wordBreak: 'break-word' }}>{passport.mnemonic}</p>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn ghost sm" to="/faucet" onClick={() => setOpen(false)}>Get tokens</Link>
            <button className="btn ghost sm" onClick={() => { signOut(); setOpen(false); }}>Sign out</button>
            {backend?.mode === 'demo' && <span className="pill">simulated</span>}
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  const { status, error, backend, forceDemo } = useApp();
  const { busy } = useRunner();
  const [navOpen, setNavOpen] = useState(false);
  const loc = useLocation();
  const close = () => setNavOpen(false);

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
            <details className="tools-nav"><summary>Tools <span>⌄</span></summary><div className="tools-menu">
              <NavLink to="/business" onClick={close}>Business lab</NavLink>
              <NavLink to="/network" onClick={close}>Network console</NavLink>
              <NavLink to="/pools" onClick={close}>Staking pools</NavLink>
              <NavLink to="/teleport" onClick={close}>Teleport bridge</NavLink>
              <NavLink to="/faucet" onClick={close}>Testnet faucet</NavLink>
            </div></details>
          </nav>
          <div className="spacer" />
          <span className="network-chip"><i className="live-indicator" />{backend?.mode === 'demo' ? 'Simulation' : 'Testnet'}</span>
          <AccountChip />
          <button className="btn ghost sm menu-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Menu" aria-expanded={navOpen}>Menu</button>
        </div>
      </header>

      {backend?.mode === 'demo' && (
        <div className="banner" role="status">
          <div className="wrap">
            <b>Simulated mode.</b> <span>Test assets and funds. Resets on reload.</span><DemoRoles />
            <button className="btn ghost sm" disabled={busy} onClick={() => (backend as any).advance(7 * 86_400)} title="Move the simulated clock forward so operators fall behind">Skip a week ahead</button>
            <button className="btn ghost sm" disabled={busy} onClick={() => forceDemo(false)}>Use the live testnet</button>
          </div>
        </div>
      )}
      {backend?.mode === 'live' && !backend.deployed && (
        <div className="banner" role="status"><div className="wrap"><b>Contracts are not deployed yet.</b> <span>You are connected to Portaldot, but Portion's contracts have not been deployed to it.</span></div></div>
      )}

      <main className="wrap page" key={loc.pathname}>
        {!['/', '/business', '/guide'].includes(loc.pathname) && status === 'connecting' && <div className="empty"><Spinner /><h3>Connecting to Portaldot V3…</h3><p>Opening a connection to the testnet.</p></div>}
        {!['/', '/business', '/guide'].includes(loc.pathname) && status === 'offline' && (
          <div className="empty">
            <h3>The Portaldot testnet is not answering</h3>
            <p>{error}. The testnet is being upgraded during the hackathon, so this happens. You can keep exploring in simulated mode, which follows the same rules as the contract.</p>
            <button className="btn primary" onClick={() => forceDemo(true)}>Explore in simulated mode</button>
          </div>
        )}
        {(['/', '/business', '/guide'].includes(loc.pathname) || (status === 'ready' && backend)) && (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/listing/:id" element={<ListingPage />} />
            <Route path="/create" element={<Create />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/operator" element={<Operator />} />
            <Route path="/network" element={<Network />} />
            <Route path="/pools" element={<Pools />} />
            <Route path="/faucet" element={<Faucet />} />
            <Route path="/teleport" element={<Teleport />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/business" element={<Business />} />
            <Route path="*" element={<div className="empty"><h3>Page not found</h3><Link className="btn primary" to="/">Back to the market</Link></div>} />
          </Routes>
        )}
      </main>
      <PassportDialog />
      <footer className="foot">
        <div className="wrap">
          <div className="footer-brand"><Link className="brand" to="/"><Logo />Portion</Link><p>Small portions. Shared possibilities.</p><small>Built on Portaldot V3 · Test tokens only. No monetary value.</small></div>
          <span><Link to="/guide">How it works</Link> · <Link to="/faucet">Faucet</Link> · <a href="/metrics">Metrics</a></span>
        </div>
      </footer>
    </>
  );
}
