import { describe, expect, it } from 'vitest';
import { paymentPreview } from '../src/lib/operator';

describe('operator revenue review', () => {
  it('shows the fee and exact amount allocated before a qualifying deposit', () => {
    expect(paymentPreview('20', 20_000_000n, 50)).toEqual({ gross: 20_000_000n, fee: 100_000n, net: 19_900_000n, qualifying: true });
  });
  it('keeps below-minimum payments valid while making their deadline effect explicit', () => {
    expect(paymentPreview('1', 20_000_000n, 50)).toEqual({ gross: 1_000_000n, fee: 5_000n, net: 995_000n, qualifying: false });
  });
  it('rejects amounts the form cannot safely submit', () => {
    for (const value of ['', '0', '-1', 'Infinity', 'abc', '0.0000001']) expect(paymentPreview(value,20_000_000n,50)).toBeNull();
  });
});
