import type { ApiPromise } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { u8aConcat, stringToU8a } from '@polkadot/util';
import type { ListingView } from '@portion/sdk';

export interface NativeProof {
  deedLocked: boolean;
  lockSource?: 'item-setting' | 'fractionalization-pallet';
  deedOwner?: string;
  fractionalized: boolean;
  fractions?: string;
  assetMatches: boolean;
  supplyMatches: boolean;
  supply?: string;
  adminIsPallet: boolean;
  rolesControlled: boolean;
  finalizedHash: string;
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
  const finalizedHash = await api.rpc.chain.getFinalizedHead();
  const state = await api.at(finalizedHash);
  const palletId = (api.consts.nftFractionalization.palletId as any).toU8a();
  const palletAccount = encodeAddress(u8aConcat(stringToU8a('modl'), palletId, new Uint8Array(32 - 4 - palletId.length)), 42);

  const item: any = (await state.query.nfts.item(l.nftCollection, l.nftItem)).toJSON();
  const deedOwner = item?.owner as string | undefined;
  // Explicit item locks disable Transferable. Fractionalization may instead enforce a runtime Locker.
  const cfg: any = (await state.query.nfts.itemConfigOf(l.nftCollection, l.nftItem)).toJSON();
  // ItemSettings stores DISABLED capabilities: bit 0 set means transfers are locked.
  const settings = cfg?.settings;
  const transfersDisabled = settings !== undefined && Number.isSafeInteger(Number(settings)) && (BigInt(settings) & 1n) === 1n;

  if (!item) notes.push('The deed NFT no longer exists. It may have been burned.');


  const map: any = (await state.query.nftFractionalization.nftToAsset([l.nftCollection, l.nftItem])).toJSON();
  const fractionalized = !!map;
  const assetMatches = fractionalized && Number(map.assetId ?? map.asset ?? map[0]) === l.assetId;
  const fractions = fractionalized ? String(BigInt(map.fractions ?? map[1] ?? 0)) : undefined;
  if (!fractionalized) notes.push('This deed was never fractionalized natively.');
  else if (!assetMatches) notes.push('The deed is fractionalized into a different asset than the listing claims.');

  const asset: any = (await state.query.assets.asset(l.assetId)).toJSON();
  const supply = asset ? String(BigInt(asset.supply)) : undefined;
  const supplyMatches = supply === String(l.totalShares);
  if (!supplyMatches) notes.push('Share supply does not match the listing.');
  const adminIsPallet = !!asset && encodeAddress(decodeAddress(asset.admin), 42) === palletAccount;
  const rolesControlled = !!asset && ['owner', 'issuer', 'admin', 'freezer'].every(role => {
    try { return encodeAddress(decodeAddress(asset[role]), 42) === palletAccount; } catch { return false; }
  });
  if (!rolesControlled) notes.push('Not all asset permissions are controlled by the fractionalization pallet. Issuance, freezing or ownership may be controlled elsewhere.');
  const fractionsMatch = fractions === String(l.totalShares);
  if (fractionalized && !fractionsMatch) notes.push('The original fraction count does not match the listing.');

  // On Portaldot V3, the fractionalization pallet's Locker blocks nfts.transfer while
  // nftToAsset exists, even when ItemSettings is zero. A signed historical dry-run
  // for listing 585886 returned nfts.ItemLocked before its optional explicit lock.
  // Require the complete native mapping/supply/role proof before accepting this path.
  const fractionalizationLock = cfg != null && assetMatches && fractionsMatch && supplyMatches && rolesControlled;
  const deedLocked = !!item && (transfersDisabled || fractionalizationLock);
  if (item && !deedLocked) notes.push('Neither an explicit item lock nor a verified fractionalization lock could be established.');
  return {
    deedLocked,
    lockSource: !deedLocked ? undefined : transfersDisabled ? 'item-setting' : 'fractionalization-pallet',
    deedOwner,
    fractionalized,
    fractions,
    assetMatches,
    supplyMatches,
    supply,
    adminIsPallet,
    rolesControlled,
    finalizedHash: finalizedHash.toHex(),
    verified: deedLocked && assetMatches && supplyMatches && rolesControlled && fractionsMatch,
    notes,
  };
}
