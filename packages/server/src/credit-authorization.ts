import { cryptoWaitReady, signatureVerify } from '@polkadot/util-crypto';
import { testCreditMessage } from '@portion/sdk';
export async function validCreditAuthorization(address: string, day: string, contract: string, signature: unknown) {
  if (typeof signature !== 'string' || !/^0x[0-9a-f]{128,132}$/i.test(signature)) return false;
  await cryptoWaitReady();
  try { return signatureVerify(testCreditMessage(address,day,contract),signature,address).isValid; }
  catch { return false; }
}
