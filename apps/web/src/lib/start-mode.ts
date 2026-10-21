/** Explicit links win, then the visitor's choice, then the hosting default. */
export function initialDemoMode(search: string, saved: string | null, defaultMode?: string): boolean {
  const params = new URLSearchParams(search);
  if (params.has('demo')) return true;
  if (params.has('live')) return false;
  if (saved === '1') return true;
  if (saved === '0') return false;
  return defaultMode === 'demo';
}
