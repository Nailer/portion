import { describe, expect, it } from 'vitest';
import { releaseDeployment } from '../src/lib/deployment-identity';
const expected:any={portion:'0x'+'11'.repeat(20),contractVersion:'core-v1',chainId:420420777,network:'portaldot-v3-testnet',pusdAssetId:4217,deedsCollection:9,treasury:'5Eh9NqMbHhbkUxZKyP8iAfL5LvnqPTEyPb8YvrY3iMoNaFT4'};
describe('pinned release identity',()=>{
  it('keeps the pinned contract when an optional service cannot respond',()=>{expect(releaseDeployment(expected,null)).toBe(expected);});
  it('refuses a matching-code deployment that silently redirects the contract, payment asset or treasury',()=>{
    for(const changed of [{portion:'0x'+'22'.repeat(20)},{pusdAssetId:4218},{treasury:'5DXZ6Qniy2tuTLxtZDDWFmHS2FXTkeaxnxCDETKaiUuBN6k7'},{chainId:1}]) expect(()=>releaseDeployment(expected,{...expected,...changed})).toThrow('No replacement');
    expect(()=>releaseDeployment(undefined,expected)).toThrow('no pinned');
  });
});
