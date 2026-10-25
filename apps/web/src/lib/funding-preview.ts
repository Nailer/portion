import { parseUnits } from '@portion/sdk/units';
export function offeredShares(total:number,percent:number) {
  return Number.isSafeInteger(total) && total>=0 && total<=1000000 && Number.isFinite(percent) && percent>=0 && percent<=100 ? Math.round(total*percent/100) : 0;
}
export function fundingAmounts(price:string,shares:number,saleFeeBps:number,bondBps:number) {
  try {
    const unit=parseUnits(price,6); if(unit<0n || !Number.isSafeInteger(shares) || shares<0) return null;
    const gross=unit*BigInt(shares);
    return {gross,minimumBond:gross*BigInt(bondBps)/10000n,netEstimate:gross-gross*BigInt(saleFeeBps)/10000n};
  } catch {return null;}
}
export function pusdInput(value:bigint) {
  const unit=1000000n; const fraction=(value%unit).toString().padStart(6,'0').replace(/0+$/,'');
  return (value/unit).toString()+(fraction?'.'+fraction:'');
}
