import { describe, expect, it } from 'vitest';
import { receiptCsv } from '../src/lib/receipt-export';
describe('verified receipt CSV', () => {
  it('preserves exact units, fees, UTC time and partial testnet scope', () => {
    const csv = receiptCsv([{id:'fixture',txHash:'0xfixture',block:10,ts:0,kind:'RevenueDeposited',listingId:777,actor:'account',data:{net:'995000',fee:'5000'}}],'Portaldot testnet',4217);
    expect(csv).toContain('"1000000","5000","995000"'); expect(csv).toContain('1970-01-01T00:00:00.000Z');
    expect(csv).toContain('PARTIAL'); expect(csv).toContain('NO MONETARY VALUE'); expect(csv).toContain('"4217","6"');
  });
  it('keeps large source integers and prevents a cell becoming a spreadsheet formula', () => {
    const csv = receiptCsv([{id:'fixture',block:10,ts:1,kind:'Claimed',listingId:777,actor:'=HYPERLINK("unsafe")',data:{amount:'9007199254740993'}}],'testnet');
    expect(csv).toContain('9007199254740993'); expect(csv).toContain("'=HYPERLINK"); expect(csv).toContain('""unsafe""');
  });
});
