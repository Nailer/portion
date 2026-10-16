import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { guestPassport, passportFromMnemonic, passportFromSignature, PASSPORT_MESSAGE, type Passport } from '@portion/sdk';
import type { Balances } from '../lib/backend';
import { useApp } from './app';

interface PassportState {
  passport: Passport | null;
  loading: boolean;
  balances: Balances | null;
  createGuest(): Promise<void>;
  connectMetaMask(): Promise<void>;
  importMnemonic(m: string): Promise<void>;
  signOut(): void;
  reloadBalances(): Promise<void>;
}

const Ctx = createContext<PassportState>(null as any);
export const usePassport = () => useContext(Ctx);
const KEY = 'portion.passport.v1';

export function PassportProvider({ children }: { children: ReactNode }) {
  const { backend, tick } = useApp();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<Balances | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { mnemonic: string; kind: Passport['kind'] } | null;
        if (saved?.mnemonic) setPassport(await passportFromMnemonic(saved.mnemonic, saved.kind));
      } catch { /* ignore a corrupted entry */ }
      setLoading(false);
    })();
  }, []);

  const persist = (p: Passport) => {
    // Guests and imports live only in this browser. MetaMask passports are re-derivable, so we keep them for convenience too.
    if (p.mnemonic) localStorage.setItem(KEY, JSON.stringify({ mnemonic: p.mnemonic, kind: p.kind }));
    setPassport(p);
  };

  const reloadBalances = useCallback(async () => {
    if (!backend || !passport) { setBalances(null); return; }
    try { setBalances(await backend.balances(passport.address)); } catch { /* transient */ }
  }, [backend, passport]);

  useEffect(() => { void reloadBalances(); }, [reloadBalances, tick]);
  useEffect(() => { const t = setInterval(() => void reloadBalances(), 15_000); return () => clearInterval(t); }, [reloadBalances]);

  const value = useMemo<PassportState>(() => ({
    passport, loading, balances, reloadBalances,
    createGuest: async () => persist(await guestPassport()),
    importMnemonic: async (m) => persist(await passportFromMnemonic(m, 'import')),
    connectMetaMask: async () => {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error('MetaMask was not found in this browser. Continue as a guest instead.');
      const [account] = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const sig = (await eth.request({ method: 'personal_sign', params: [PASSPORT_MESSAGE, account] })) as string;
      const p = await passportFromSignature(sig);
      // MetaMask passports are never stored: signing again re-creates exactly the same account.
      setPassport(p);
    },
    signOut: () => { localStorage.removeItem(KEY); setPassport(null); setBalances(null); },
  }), [passport, loading, balances, reloadBalances]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
