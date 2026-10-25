import { describe, expect, it } from 'vitest';
import { offeredShares, fundingAmounts, pusdInput } from '../src/lib/funding-preview';
describe('exact funding inputs',()=>{
  it('preserves source units beyond floating-point precision and the contract minimum-bond floor',()=>{
    const result=fundingAmounts('9007199254.740993',100,100,500)!;
    expect(result.gross).toBe(900719925474099300n);
    expect(result.minimumBond).toBe(result.gross/20n);
    expect(pusdInput(50001n)).toBe('0.050001');
  });
  it('keeps malformed share input from crashing a draft or manufacturing money',()=>{
    expect(offeredShares(Infinity,100)).toBe(0);expect(offeredShares(100,NaN)).toBe(0);
    expect(fundingAmounts('invalid',100,100,500)).toBeNull();
    expect(offeredShares(100,25)).toBe(25);
  });
});
