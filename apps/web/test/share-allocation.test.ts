import { describe, expect, it } from 'vitest';
import { shareAllocation } from '../src/lib/share-allocation';
const listing = (staked: bigint, forSale = 0): any => ({totalShares:100,vault:{totalStaked:staked,forSale,sold:100}});
describe('earning stake is distinct from historical sales and ownership', () => {
  it('does not label unstaked purchased shares as held by other people or retained by the operator', () => {
    expect(shareAllocation(listing(0n),0)).toEqual({mine:0,otherStake:0,available:0,outside:100});
    expect(shareAllocation(listing(60n,20),10)).toEqual({mine:10,otherStake:50,available:20,outside:20});
  });
  it('keeps inconsistent counts unavailable instead of manufacturing a percentage', () => {
    expect(shareAllocation(listing(101n),0)).toBeNull();
    expect(shareAllocation(listing(90n,20),0)).toBeNull();
    expect(shareAllocation(listing(10n),11)).toBeNull();
  });
});
