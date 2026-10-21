import { useState } from 'react';
import { useRunner } from '../state/runner';
import { usePassport } from '../state/passport';
import { useApp } from '../state/app';

export function PassportDialog() {
  const { passportOpen, closePassport } = useRunner();
  const { createGuest, connectMetaMask, importMnemonic } = usePassport();
  const { backend, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [phrase, setPhrase] = useState('');
  const [showImport, setShowImport] = useState(false);
  if (!passportOpen) return null;

  const go = async (fn: () => Promise<void>, fund = true) => {
    setBusy(true); setErr(undefined);
    try {
      await fn();
      closePassport();
      refresh();
      void fund;
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closePassport(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="pp-title">
        <h2 id="pp-title">Your account starts here.</h2>
        <p className="sheet-sub">
          Choose an account to hold your test funds and shares. {backend?.mode === 'demo' ? 'For the walkthrough, you can also use the separate Operator and Funder buttons in the simulation banner.' : 'Guest accounts are stored in this browser. Save the recovery phrase before using them for testnet activity.'}
        </p>
        <div className="choices">
          <button className="choice" disabled={busy} onClick={() => go(createGuest)}>
            <b>Continue as a guest</b>
            <span>Creates a Passport in this browser in a second. Back it up from the account menu when you are ready.</span>
          </button>
          <button className="choice" disabled={busy} onClick={() => go(connectMetaMask)}>
            <b>Use MetaMask</b>
            <span>Use a signature to unlock a Portion account linked to your wallet. This does not transfer funds.</span>
          </button>
          <button className="choice" disabled={busy} onClick={() => setShowImport((v) => !v)}>
            <b>Import a recovery phrase</b>
            <span>Bring a Passport you saved earlier.</span>
          </button>
        </div>
        {showImport && (
          <form className="import" onSubmit={(e) => { e.preventDefault(); void go(() => importMnemonic(phrase)); }}>
            <label htmlFor="phrase">Recovery phrase (12 words)</label>
            <textarea id="phrase" rows={2} value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="word1 word2 word3 …" />
            <button className="btn primary" disabled={busy || phrase.trim().split(/\s+/).length < 12}>Import</button>
          </form>
        )}
        {err && <p className="sheet-error">{err}</p>}
        <div className="sheet-actions"><button className="btn ghost" onClick={closePassport}>Not now</button></div>
      </div>
    </div>
  );
}
