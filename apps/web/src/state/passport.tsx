import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { guestPassport, type Passport } from '@portion/sdk';
import type { Balances } from '../lib/backend';
import { installedWallets, requestWallet, walletAddress, walletPassport, type InjectedWallet, type WalletAccount } from '../lib/wallet';
import { useApp } from './app';

interface PassportState {
  passport: Passport | null;
  loading: boolean;
  balances: Balances | null;
  demoRole: 'operator' | 'funder' | null;
  walletAccounts: WalletAccount[];
  requestConnection(provider: string): Promise<void>;
  selectAccount(address: string): void;
  switchDemoRole(role: 'operator' | 'funder'): Promise<void>;
  signOut(): void;
  reloadBalances(): Promise<void>;
}
const Ctx = createContext<PassportState>(null as any);
export const usePassport = () => useContext(Ctx);

export function PassportProvider({ children }: { children: ReactNode }) {
  const { backend, tick } = useApp();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [demoRole, setDemoRole] = useState<'operator' | 'funder' | null>(null);
  const [walletAccounts, setAccounts] = useState<WalletAccount[]>([]);
  const wallet = useRef<InjectedWallet | null>(null);
  const walletUnsubscribe = useRef<(() => void) | undefined>();
  const selectedWalletAddress = useRef<string | null>(null);
  const demoAccounts = useRef<Partial<Record<'operator' | 'funder', Passport>>>({});
  const activePassport = backend?.mode === 'demo' && demoRole ? demoAccounts.current[demoRole] ?? null : passport;
  const balanceRequest = useRef(0);
  const [balances, setBalances] = useState<Balances | null>(null);

  // Never restore, write or expose secrets from the legacy browser account store.
  // Existing records remain untouched so this update cannot destroy someone's only backup.
  useEffect(() => () => walletUnsubscribe.current?.(), []);
  const reloadBalances = useCallback(async () => {
    const request = ++balanceRequest.current;
    if (!backend || !activePassport) { setBalances(null); return; }
    try { const next = await backend.balances(activePassport.address); if (request === balanceRequest.current) setBalances(next); } catch { /* transient */ }
  }, [backend, activePassport]);
  useEffect(() => { void reloadBalances(); }, [reloadBalances, tick]);
  useEffect(() => { const timer = setInterval(() => void reloadBalances(), 15_000); return () => clearInterval(timer); }, [reloadBalances]);

  const value = useMemo<PassportState>(() => ({
    passport: activePassport, loading: false, balances, reloadBalances, walletAccounts,
    demoRole: backend?.mode === 'demo' ? demoRole : null,
    requestConnection: async provider => {
      const result = await requestWallet(installedWallets()[provider]);
      walletUnsubscribe.current?.();
      wallet.current = result.wallet;
      setAccounts(result.accounts);
      walletUnsubscribe.current = result.wallet.accounts.subscribe?.(accounts => {
        const compatible = accounts.filter(account => { try { walletAddress(account.address); return true; } catch { return false; } });
        setAccounts(compatible);
        if (selectedWalletAddress.current && !compatible.some(account => walletAddress(account.address) === selectedWalletAddress.current)) {
          selectedWalletAddress.current = null;
          balanceRequest.current++;
          setPassport(null); setBalances(null);
        }
      });
    },
    selectAccount: address => {
      const account = walletAccounts.find(account => account.address === address);
      if (!account || !wallet.current) throw new Error('Choose an account currently shared by your wallet.');
      const connected = walletPassport(account, wallet.current);
      selectedWalletAddress.current = connected.address;
      balanceRequest.current++;
      setBalances(null); setDemoRole(null); setPassport(connected);
    },
    switchDemoRole: async role => {
      if (backend?.mode !== 'demo') throw new Error('Demo roles are only available in simulation.');
      if (demoRole === role) return;
      balanceRequest.current++;
      if (!demoAccounts.current[role]) {
        const { mnemonic: _unused, ...account } = await guestPassport();
        demoAccounts.current[role] = account;
      }
      setBalances(null); setDemoRole(role);
    },
    signOut: () => {
      walletUnsubscribe.current?.(); walletUnsubscribe.current = undefined;
      wallet.current = null; selectedWalletAddress.current = null;
      balanceRequest.current++;
      setAccounts([]); setDemoRole(null); demoAccounts.current = {}; setPassport(null); setBalances(null);
    },
  }), [activePassport, backend, demoRole, balances, reloadBalances, walletAccounts]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
