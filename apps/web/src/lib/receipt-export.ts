import type { ActivityRow } from './backend';
const cell = (value: unknown) => {
  let text = value === undefined || value === null ? '' : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"','""') + '"';
};
/** Exact event units; no inferred business revenue or missing-record totals. */
export function receiptCsv(rows: ActivityRow[], chain: string, paymentAssetId?: number) {
  const headers = ['network','scope','coverage','transaction_hash','finalized_block','timestamp_utc','event','asset_id','actor','payment_asset_id','payment_decimals','deposit_gross_raw','deposit_fee_raw','deposit_net_raw','bond_allocation_raw','claim_raw','event_json'];
  const records = rows.map(row => {
    const d = row.data; const deposit = row.kind === 'RevenueDeposited';
    const gross = deposit && /^\d+$/.test(String(d.net)) && /^\d+$/.test(String(d.fee)) ? (BigInt(d.net)+BigInt(d.fee)).toString() : '';
    return [chain,'TESTNET — NO MONETARY VALUE','PARTIAL: included app-published receipts only; latest API limit applies',row.txHash,row.block,new Date(row.ts*1000).toISOString(),row.kind,row.listingId,row.actor,paymentAssetId,6,gross,deposit?d.fee:'',deposit?d.net:'',row.kind==='Slashed'?d.toHolders??d.holders:'',row.kind==='Claimed'?d.amount:'',JSON.stringify(d,(_k,value)=>typeof value==='bigint'?value.toString():value)];
  });
  return [headers,...records].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url; link.download=name; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
