import { beforeAll, describe, expect, it } from 'vitest';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { u8aToHex, u8aWrapBytes, stringToU8a } from '@polkadot/util';
import { testCreditMessage } from '@portion/sdk';
import { validCreditAuthorization } from '../src/credit-authorization';
beforeAll(async()=>{await cryptoWaitReady();});
describe('test-credit ownership proof',()=>{
  it('binds an off-chain signature to recipient, day, contract and purpose',async()=>{
    const pair=new Keyring({type:'sr25519',ss58Format:42}).addFromUri('//Alice'); // Public development fixture, never a service account.
    const other=new Keyring({type:'sr25519',ss58Format:42}).addFromUri('//Bob');
    const contract='0x'+'11'.repeat(20); const day='2026-10-25';
    const signature=u8aToHex(pair.sign(testCreditMessage(pair.address,day,contract)));
    expect(await validCreditAuthorization(pair.address,day,contract,signature)).toBe(true);
    const wrapped=u8aToHex(pair.sign(u8aWrapBytes(stringToU8a(testCreditMessage(pair.address,day,contract))),{withType:true}));
    expect(await validCreditAuthorization(pair.address,day,contract,wrapped)).toBe(true);
    expect(await validCreditAuthorization(other.address,day,contract,signature)).toBe(false);
    expect(await validCreditAuthorization(pair.address,'2026-10-26',contract,signature)).toBe(false);
    expect(await validCreditAuthorization(pair.address,day,'0x'+'22'.repeat(20),signature)).toBe(false);
    expect(await validCreditAuthorization(pair.address,day,contract,'0x00')).toBe(false);
  });
});
