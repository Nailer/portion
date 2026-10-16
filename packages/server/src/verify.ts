import type { ApiPromise } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { u8aConcat, stringToU8a } from '@polkadot/util';
import type { ListingView } from '@portion/sdk';

export interface NativeProof {
  deedLocked: boolean;
  deedOwner?: string;
  fractionalized: boolean;
  fractions?: string;
  assetMatches: boolean;
  supplyMatches: boolean;
  supply?: string;
  adminIsPallet: boolean;
  verified: boolean;
  notes: string[];
}

/**
* The Solidity registry can only *see* a share token. This checks the native layer to prove the shares are backed:
 * the deed NFT must still exist with transfers disabled, it must be mapped to this very share asset by the
 * fractionalization pallet, and only the pallet may administer that asset. Anything that fails here is shown to
 * investors. Known limit: pallet-nfts lets an item's owner burn it, which the "still exists" check will catch.
 */
export async function verifyListing(api: ApiPromise, l: ListingView): Promise<NativeProof> {
  const notes: string[] = [];
  const palletId = (api.consts.nftFractionalization.palletId as any).toU8a();
  const palletAccount = encodeAddress(u8aConcat(stringToU8a('modl'), palletId, new Uint8Array(32 - 4 - palletId.length)), 42);

  const item: any = (await api.query.nfts.item(l.nftCollection, l.nftItem)).toJSON();
  const deedOwner = item?.owner as string | undefined;
  // The pallet does not move the deed: it switches transfers off for it (the Transferable bit of the item config).
  const cfg: any = (await api.query.nfts.itemConfigOf(l.nftCollection, l.nftItem)).toJSON();
  const transferable = (Number(cfg?.settings ?? 1) & 1) === 1;
  const deedLocked = !!item && !transferable;
  if (!item) notes.push('The deed NFT no longer exists. It may have been burned.');
  else if (transferable) notes.push('Transfers of the deed NFT are still enabled.');

  const map: any = (await api.query.nftFractionalization.nftToAsset([l.nftCollection, l.nftItem])).toJSON();
  const fractionalized = !!map;
  const assetMatches = fractionalized && Number(map.assetId ?? map.asset ?? map[0]) === l.assetId;
  const fractions = fractionalized ? String(BigInt(map.fractions ?? map[1] ?? 0)) : undefined;
  if (!fractionalized) notes.push('This deed was never fractionalized natively.');
  else if (!assetMatches) notes.push('The deed is fractionalized into a different asset than the listing claims.');

  const asset: any = (await api.query.assets.asset(l.assetId)).toJSON();
  const supply = asset ? String(BigInt(asset.supply)) : undefined;
  const supplyMatches = supply === String(l.totalShares);
  if (!supplyMatches) notes.push('Share supply does not match the listing.');
  const adminIsPallet = !!asset && encodeAddress(decodeAddress(asset.admin), 42) === palletAccount;
  if (!adminIsPallet) notes.push('The share asset can still be administered by someone other than the pallet.');

  return {
    deedLocked,
    deedOwner,
    fractionalized,
    fractions,
    assetMatches,
    supplyMatches,
    supply,
    adminIsPallet,
    verified: deedLocked && assetMatches && supplyMatches && adminIsPallet,
    notes,
  };
}
