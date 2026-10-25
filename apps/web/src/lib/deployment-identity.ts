import type { Deployment } from '@portion/sdk';
import { ss58ToH160 } from '@portion/sdk/addresses';
export function releaseDeployment(expected: Deployment | undefined, advertised: Deployment | null | undefined) {
  if (!expected) throw new Error('This release has no pinned funding deployment. Financial actions are unavailable.');
  if (advertised && (advertised.portion?.toLowerCase() !== expected.portion.toLowerCase() || advertised.contractVersion !== expected.contractVersion ||
    advertised.chainId !== expected.chainId || advertised.network !== expected.network || advertised.pusdAssetId !== expected.pusdAssetId || advertised.deedsCollection !== expected.deedsCollection ||
    !advertised.treasury || ss58ToH160(advertised.treasury) !== ss58ToH160(expected.treasury))) throw new Error('The service deployment differs from this release. No replacement contract or payment asset was accepted.');
  return expected;
}
