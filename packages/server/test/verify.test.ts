import { describe, expect, it } from 'vitest';
import { encodeAddress } from '@polkadot/util-crypto';
import { stringToU8a, u8aConcat } from '@polkadot/util';
import { verifyListing } from '../src/verify';
import type { ListingView } from '@portion/sdk';
const palletId = stringToU8a('frac/pal');
const pallet = encodeAddress(u8aConcat(stringToU8a('modl'), palletId, new Uint8Array(20)), 42);
const other = encodeAddress(new Uint8Array(32).fill(1), 42);
const listing = { nftCollection: 1, nftItem: 2, assetId: 3, totalShares: 100 } as ListingView;
function fixture({ settings = 1, issuer = pallet, fractions = 100, missingConfig = false } = {}) {
  const json = (value: unknown) => async () => ({ toJSON: () => value });
  const state = { query: {
    nfts: { item: json({ owner: other }), itemConfigOf: json(missingConfig ? null : { settings }) },
    nftFractionalization: { nftToAsset: json({ asset: 3, fractions }) },
    assets: { asset: json({ supply: 100, owner: pallet, issuer, admin: pallet, freezer: pallet }) },
  } };
  return { consts: { nftFractionalization: { palletId: { toU8a: () => palletId } } },
    rpc: { chain: { getFinalizedHead: async () => ({ toHex: () => '0xfinal' }) } }, at: async () => state } as any;
}
describe('native listing proof', () => {
  it('recognizes the disabled-transfer flag and verifies all asset roles at finalized state', async () => {
    expect(await verifyListing(fixture(), listing)).toMatchObject({ deedLocked: true, rolesControlled: true, verified: true, finalizedHash: '0xfinal' });
  });
  it('does not label an unlocked deed or missing configuration as locked', async () => {
    expect((await verifyListing(fixture({ settings: 0 }), listing)).deedLocked).toBe(false);
    expect((await verifyListing(fixture({ missingConfig: true }), listing)).verified).toBe(false);
  });
  it('rejects an externally controlled issuer even when the admin belongs to the pallet', async () => {
    expect(await verifyListing(fixture({ issuer: other }), listing)).toMatchObject({ adminIsPallet: true, rolesControlled: false, verified: false });
  });
  it('checks the fractionalization count as well as current supply', async () => {
    expect((await verifyListing(fixture({ fractions: 200 }), listing)).verified).toBe(false);
  });
});
