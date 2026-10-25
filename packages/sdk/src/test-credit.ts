/** Human-readable, purpose-bound off-chain authorization. Never an extrinsic payload. */
export function testCreditMessage(address: string, day: string, contract: string) {
  return `Portion test-credit request\nNetwork genesis: 0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd\nContract: ${contract.toLowerCase()}\nNative recipient: ${address}\nUTC day: ${day}\nRequest: 500 test pUSD credits only. No native tPOT transfer, asset purchase or access to wallet keys is authorized.`;
}
