import type { PlanStep } from '@portion/sdk';

/** The calls a tokenize action will make, for the live preview next to the form. Real ids are filled in at submit time. */
export function tokenizeSteps(totalShares: number): PlanStep[] {
  return [
    { key: 'doc', lane: 'storage', pallet: 'TransactionStorage', method: 'store', title: 'Store the terms on-chain', detail: 'Content-addressed. The chain keeps it for about 7 days and a keeper renews it.' },
    { key: 'cover', lane: 'storage', pallet: 'TransactionStorage', method: 'store', title: 'Store the photo on-chain', detail: 'Compressed to fit the 32 KB per-transaction limit.' },
    { key: 'mint', lane: 'native', pallet: 'Nfts', method: 'mint', title: 'Mint the deed', detail: 'A native NFT in the shared Portion Deeds collection represents the asset itself.' },
    { key: 'meta', lane: 'native', pallet: 'Nfts', method: 'setMetadata', title: 'Pin the terms hash to the deed', detail: 'The NFT carries the hash of the terms stored on-chain.' },
    { key: 'frac', lane: 'native', pallet: 'NftFractionalization', method: 'fractionalize', title: `Split into ${totalShares.toLocaleString()} shares`, detail: 'The pallet locks the deed and mints a fixed supply of native shares.' },
    { key: 'ap1', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Allow the registry to escrow shares for sale', detail: 'Native approval, seen by Solidity as an ERC-20 allowance.' },
    { key: 'ap2', lane: 'native', pallet: 'Assets', method: 'approveTransfer', title: 'Allow the registry to hold your bond', detail: 'The bond is slashed to holders if revenue stops.' },
    { key: 'evm', lane: 'evm', pallet: 'Revive', method: 'call', title: 'Register the listing in Solidity', detail: 'Portion.createListing(...) checks supply, pulls shares and bond, opens the sale.' },
  ];
}
