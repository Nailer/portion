export async function verifiedPhoto(bytes: Uint8Array, hash: string) {
  const {contentHash,MAX_DOC_BYTES}=await import('@portion/sdk/storage');
  if(bytes.length>MAX_DOC_BYTES || contentHash(bytes).toLowerCase()!==hash.toLowerCase()) throw new Error('Photo bytes do not match the recorded hash.');
  const prefix=(values:number[])=>values.every((value,index)=>bytes[index]===value);
  if(prefix([137,80,78,71,13,10,26,10])) return 'image/png';
  if(prefix([255,216,255])) return 'image/jpeg';
  if(prefix([82,73,70,70]) && bytes[8]===87 && bytes[9]===69 && bytes[10]===66 && bytes[11]===80) return 'image/webp';
  throw new Error('The recorded photo is not a supported image.');
}
