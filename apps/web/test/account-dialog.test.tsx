import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PassportDialog } from '../src/components/PassportDialog';
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../src/state/runner', () => ({ useRunner: () => ({ passportOpen: true, closePassport: vi.fn() }) }));
vi.mock('../src/state/app', () => ({ useApp: () => ({ refresh: vi.fn() }) }));
vi.mock('../src/state/passport', () => ({ usePassport: () => ({ requestConnection: vi.fn(), selectAccount: vi.fn(), walletAccounts: [] }) }));

describe('account dialog secret-entry regression', () => {
  it('offers existing wallet connection without any secret entry fields', () => {
    const html = renderToStaticMarkup(<PassportDialog/>);
    expect(html).not.toMatch(/<(input|textarea)\b/i);
    expect(html).not.toContain('Import a recovery phrase');
    expect(html).not.toContain('Use MetaMask');
    expect(html).toContain('We never ask for your recovery phrase.');
    expect(html).not.toContain('Explore as a funder');
    expect(html).not.toContain('Try the operator workspace');
    expect(html).toContain('Portion does not create accounts or grant balances.');
  });
});
