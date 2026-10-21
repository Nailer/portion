import { describe, expect, it } from 'vitest';
import { deploymentBudget } from '../../../scripts/deployment-budget';
import type { DryRun } from '@portion/sdk';
const dry: DryRun = { ok:true,reverted:false,data:'0x',deposit:100n*10n**14n,weight:{refTime:1n,proofSize:1n} };
describe('deployment budget safety',()=>{
  it('includes a deposit margin and operating buffer',()=>{
    expect(deploymentBudget([{name:'Portion',dry}],40n*10n**14n)).toBe(166n*10n**14n);
  });
  it('does not treat a failed dry run as a cheap deployment',()=>{
    expect(()=>deploymentBudget([{name:'Portion',dry:{...dry,ok:false,deposit:0n,error:'runtime rejected'}}],0n)).toThrow('No deployment is allowed');
    expect(()=>deploymentBudget([{name:'Portion',dry:{...dry,reverted:true}}],0n)).toThrow('No deployment is allowed');
  });
});
