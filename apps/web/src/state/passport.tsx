import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { type Passport } from '@portion/sdk';
import type { Balances } from '../lib/backend';
import { installedWallets, requestWallet, walletAddress, walletPassport, type InjectedWallet, type WalletAccount } from '../lib/wallet';
import { useApp } from './app';

interface PassportState {
  passport: Passport | null;
  loading: boolean;
  balances: Balances | null;
  walletAccounts: WalletAccount[];
  requestConnection(provider: string): Promise<void>;
  selectAccount(address: string): void;
  signOut(): void;
  reloadBalances(): Promise<void>;
}
const Ctx = createContext<PassportState>(null as any);
export const usePassport = () => useContext(Ctx);

export function PassportProvider({ children }: { children: ReactNode }) {
  const { backend, tick } = useApp();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [walletAccounts, setAccounts] = useState<WalletAccount[]>([]);
  const wallet = useRef<InjectedWallet | null>(null);
  const walletUnsubscribe = useRef<(() => void) | undefined>();
  const selectedWalletAddress = useRef<string | null>(null);
  const connectionRequest = useRef(0);
  const authorization = useRef(0);
  // In the sandbox the visitor acts as labelled roles with pretend balances; no wallet is involved.
  const [persona, setPersonaState] = useState(() => { try { return sessionStorage.getItem('portion.sandbox.role') ?? 'buyerA'; } catch { return 'buyerA'; } });
  const setPersona = (key: string) => { setPersonaState(key); try { sessionStorage.setItem('portion.sandbox.role', key); } catch { /* storage blocked */ } };
  const personas = backend?.sandbox?.personas;
  const activePassport = personas ? personas.find(p => p.key === persona)?.passport ?? null : passport;
  const balanceRequest = useRef(0);
  const [balances, setBalances] = useState<Balances | null>(null);

  // Never restore, write or expose secrets from the legacy browser account store.
  // Existing records remain untouched so this update cannot destroy someone's only backup.
  useEffect(() => () => { connectionRequest.current++; authorization.current++; walletUnsubscribe.current?.(); }, []);
  const reloadBalances = useCallback(async () => {
    const request = ++balanceRequest.current;
    if (!backend || !activePassport) { setBalances(null); return; }
    try { const next = await backend.balances(activePassport.address); if (request === balanceRequest.current) setBalances(next); } catch { if (request === balanceRequest.current) setBalances(null); }
  }, [backend, activePassport]);
  useEffect(() => { void reloadBalances(); }, [reloadBalances, tick]);
  useEffect(() => { const timer = setInterval(() => void reloadBalances(), 15_000); return () => clearInterval(timer); }, [reloadBalances]);

  const value = useMemo<PassportState>(() => ({
    passport: activePassport, loading: false, balances, reloadBalances, walletAccounts,
    requestConnection: async provider => {
      const request = ++connectionRequest.current;
      authorization.current++;
      walletUnsubscribe.current?.(); walletUnsubscribe.current = undefined;
      wallet.current = null; selectedWalletAddress.current = null;
      balanceRequest.current++;
      setPassport(null); setBalances(null); setAccounts([]);
      const result = await requestWallet(installedWallets()[provider]);
      if (request !== connectionRequest.current) throw new Error('This wallet connection was replaced or cancelled. Connect again.');
      wallet.current = result.wallet;
      setAccounts(result.accounts);
      const unsubscribe = await result.wallet.accounts.subscribe?.(accounts => {
        if (request !== connectionRequest.current) return;
        const compatible = accounts.filter(account => { try { walletAddress(account.address); return true; } catch { return false; } });
        setAccounts(compatible);
        if (selectedWalletAddress.current && !compatible.some(account => walletAddress(account.address) === selectedWalletAddress.current)) {
          authorization.current++;
          selectedWalletAddress.current = null;
          balanceRequest.current++;
          setPassport(null); setBalances(null);
        }
      });
      if (request !== connectionRequest.current) { unsubscribe?.(); return; }
      walletUnsubscribe.current = unsubscribe;
    },
    selectAccount: address => {
      const role = personas?.find(p => p.key === address || p.passport.address === address);
      if (personas) { if (!role) throw new Error('Choose one of the sandbox roles.'); balanceRequest.current++; setBalances(null); setPersona(role.key); return; }
      const account = walletAccounts.find(account => account.address === address);
      if (!account || !wallet.current) throw new Error('Choose an account currently shared by your wallet.');
      const source = wallet.current;
      const revision = ++authorization.current;
      const addressKey = walletAddress(account.address);
      const connected = walletPassport(account, source, () => {
        if (authorization.current !== revision || wallet.current !== source || selectedWalletAddress.current !== addressKey) {
          throw new Error('Your wallet account changed or disconnected. Start a new review before signing.');
        }
      });
      selectedWalletAddress.current = connected.address;
      balanceRequest.current++;
      setBalances(null); setPassport(connected);
    },
    signOut: () => {
      connectionRequest.current++; authorization.current++;
      walletUnsubscribe.current?.(); walletUnsubscribe.current = undefined;
      wallet.current = null; selectedWalletAddress.current = null;
      balanceRequest.current++;
      setAccounts([]); setPassport(null); setBalances(null);
    },
  }), [activePassport, backend, balances, reloadBalances, walletAccounts, personas]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
