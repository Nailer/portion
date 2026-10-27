import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RECORDED } from '../src/lib/evidence';

const read = (name: string) => JSON.parse(readFileSync(resolve(__dirname, '../../../deployments', name), 'utf8'));

describe('recorded evidence matches the committed deployment records', () => {
  const core = read('portaldot-testnet.json');
  const listing = read('portion-test-listing.json');
  it('uses the deployed Core identity', () => {
    expect(RECORDED.core.address).toBe(core.portion);
    expect(RECORDED.core.block).toBe(core.deployedBlock);
    expect(RECORDED.core.deployTx).toBe(core.txs.portion);
    expect(RECORDED.chainId).toBe(core.chainId);
    expect(RECORDED.paymentAssetId).toBe(core.pusdAssetId);
    expect(RECORDED.deedCollection).toBe(core.deedsCollection);
  });
  it('uses the finalized test-listing receipts', () => {
    expect(RECORDED.listing.assetId).toBe(listing.assetId);
    expect(RECORDED.listing.nftItem).toBe(listing.nftItem);
    expect(RECORDED.steps.map(s => [s.hash, s.block])).toEqual([
      [listing.terms.hash, listing.terms.block], [listing.cover.hash, listing.cover.block],
      [listing.creation.hash, listing.creation.block], [listing.journey.hash, listing.journey.block],
    ]);
  });
  it('keeps the single-account disclosure', () => {
    expect(listing.journey.singleDevelopmentAccount).toBe(true);
    expect(RECORDED.limits.join(' ')).toMatch(/one development account/i);
  });
});
