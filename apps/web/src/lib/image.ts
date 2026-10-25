/** Creates a public thumbnail within the runtime document budget; original metadata is not copied. */
export async function compressImage(file: File, maxBytes = 28_000): Promise<{ bytes: Uint8Array; mime: string; width: number; height: number }> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photograph.');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose an image between 1 byte and 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 25_000_000) throw new Error('This image is too large to process safely. Export a photograph under 25 megapixels.');
    const scale = Math.min(1,960/bitmap.width,960/bitmap.height);
    let width = Math.max(1,Math.round(bitmap.width*scale));
    for (let attempt = 0; attempt < 8; attempt++) {
      const height = Math.max(1,Math.round(bitmap.height*width/bitmap.width));
      const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
      const context = canvas.getContext('2d'); if(!context) throw new Error('Image processing is unavailable in this browser.');
      context.fillStyle='#ffffff'; context.fillRect(0,0,width,height); context.drawImage(bitmap,0,0,width,height);
      // Prefer a smaller clear image over an aggressively degraded large image.
      for (const mime of ['image/webp','image/jpeg']) for (const quality of [0.86,0.76,0.66,0.56]) {
        const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,mime,quality));
        if(blob && blob.type===mime && blob.size<=maxBytes) return {bytes:new Uint8Array(await blob.arrayBuffer()),mime,width,height};
      }
      width=Math.max(1,Math.round(width*0.78));
    }
    throw new Error('This photograph could not fit the native document budget clearly. Crop to the actual equipment or choose a simpler photograph.');
  } finally { bitmap.close(); }
}
