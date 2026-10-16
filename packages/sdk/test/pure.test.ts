import { describe, expect, it } from 'vitest';
import { decodeAddress } from '@polkadot/util-crypto';
import { assetErc20Address, h160ToFallbackSs58, isH160, ss58ToH160 } from '../src/addresses';
import { formatUnits, parseUnits, fmtDuration } from '../src/units';
import { contentHash, MAX_DOC_BYTES } from '../src/storage';
import { guestPassport, passportFromSignature, passportFromMnemonic, PASSPORT_MESSAGE } from '../src/passport';

describe('address mapping', () => {
  it('maps a Substrate account to the H160 Solidity sees (value verified on the live testnet)', () => {
    expect(ss58ToH160('5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4')).toBe('0xdd62efd46da4acc4b8b2c7e3bf1685b2c9cee167');
  });

  it('round-trips the 0xEE fallback form', () => {
    const h = '0xdd62efd46da4acc4b8b2c7e3bf1685b2c9cee167';
    const ss58 = h160ToFallbackSs58(h);
    const raw = decodeAddress(ss58);
    expect(Buffer.from(raw.subarray(0, 20)).toString('hex')).toBe(h.slice(2));
    expect(raw.subarray(20).every((x) => x === 0xee)).toBe(true);
    expect(ss58ToH160(ss58)).toBe(h);
  });

  it('rejects malformed H160', () => {
    expect(isH160('0x123')).toBe(false);
    expect(() => h160ToFallbackSs58('nope')).toThrow();
  });
});

describe('native asset → ERC-20 address', () => {
  it('matches the address confirmed on the live testnet for asset 1', () => {
    expect(assetErc20Address(1)).toBe('0x0000000100000000000000000000000000010000');
  });
  it('places big ids in the first four bytes', () => {
    expect(assetErc20Address(0xdeadbeef)).toBe('0xdeadbeef00000000000000000000000000010000');
  });
});

describe('units', () => {
  it('formats with grouping and trims zeros', () => {
    expect(formatUnits(1_234_567_890000n, 6)).toBe('1,234,567.89');
    expect(formatUnits(10n ** 14n, 14)).toBe('1');
    expect(formatUnits(0n, 6)).toBe('0');
  });
  it('parses decimals', () => {
    expect(parseUnits('25.5', 6)).toBe(25_500_000n);
  });
  it('humanises durations', () => {
    expect(fmtDuration(120)).toBe('2 min');
    expect(fmtDuration(604_800)).toBe('7 days');
  });
});

describe('documents', () => {
  it('hashes with blake2-256 (what TransactionStorage records)', () => {
    expect(contentHash(new Uint8Array([]))).toBe('0x0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8');
    expect(MAX_DOC_BYTES).toBe(32768);
  });
});

describe('passport', () => {
  it('derives the same account from the same MetaMask signature', async () => {
    const sig = '0x' + 'ab'.repeat(65);
    const a = await passportFromSignature(sig);
    const b = await passportFromSignature(sig);
    const c = await passportFromSignature('0x' + 'cd'.repeat(65));
    expect(a.address).toBe(b.address);
    expect(a.address).not.toBe(c.address);
    expect(a.h160).toBe(ss58ToH160(a.address));
  });
  it('guest passports are unique and restorable from their mnemonic', async () => {
    const g = await guestPassport();
    const again = await passportFromMnemonic(g.mnemonic!, 'guest');
    expect(again.address).toBe(g.address);
    expect((await guestPassport()).address).not.toBe(g.address);
  });
  it('keeps the sign-in message stable (changing it would orphan every user)', () => {
    expect(PASSPORT_MESSAGE.startsWith('Unlock your Portion Passport')).toBe(true);
    expect(PASSPORT_MESSAGE.endsWith('Version: 1')).toBe(true);
  });
});
