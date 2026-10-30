import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ThemeName = 'light' | 'dark';
/** index.html reads the same key before first paint, so a saved theme never flashes. */
export const THEME_KEY = 'portion.theme';
const BROWSER_BAR: Record<ThemeName, string> = { light: '#f4f7fd', dark: '#0b1424' };

export const parseChoice = (value: unknown): ThemeChoice => value === 'light' || value === 'dark' ? value : 'system';
export const resolveTheme = (choice: ThemeChoice, systemDark: boolean): ThemeName => choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;

const query = () => window.matchMedia('(prefers-color-scheme: dark)');
function readChoice(): ThemeChoice { try { return parseChoice(localStorage.getItem(THEME_KEY)); } catch { return 'system'; } }

function apply(choice: ThemeChoice) {
  const theme = resolveTheme(choice, query().matches);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BROWSER_BAR[theme]);
}

let current: ThemeChoice | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const getChoice = () => (current ??= readChoice());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The saved choice, and a setter. System follows the device live; other tabs stay in step. */
export function useTheme() {
  const choice = useSyncExternalStore(subscribe, getChoice, () => 'system' as ThemeChoice);
  useEffect(() => {
    const media = query();
    const follow = () => { if (getChoice() === 'system') apply('system'); };
    const otherTab = (event: StorageEvent) => { if (event.key === THEME_KEY) { current = parseChoice(event.newValue); apply(current); notify(); } };
    media.addEventListener('change', follow);
    window.addEventListener('storage', otherTab);
    return () => { media.removeEventListener('change', follow); window.removeEventListener('storage', otherTab); };
  }, []);
  const setChoice = useCallback((next: ThemeChoice) => {
    current = next;
    try { if (next === 'system') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, next); } catch { /* Storage blocked: the choice still applies to this page. */ }
    apply(next);
    notify();
  }, []);
  return [choice, setChoice] as const;
}
