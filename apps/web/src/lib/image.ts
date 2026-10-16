/** Shrinks a photo until it fits the chain's 32 KB-per-transaction document limit, trying WebP then JPEG. */
export async function compressImage(file: File, maxBytes = 28_000): Promise<{ bytes: Uint8Array; mime: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  let width = Math.min(960, bitmap.width);
  for (let attempt = 0; attempt < 8; attempt++) {
    const height = Math.round((bitmap.height * width) / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    for (const mime of ['image/webp', 'image/jpeg']) {
      for (const q of [0.82, 0.68, 0.52, 0.38, 0.26]) {
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, mime, q));
        if (blob && blob.type === mime && blob.size <= maxBytes) return { bytes: new Uint8Array(await blob.arrayBuffer()), mime, width, height };
      }
    }
    width = Math.round(width * 0.78);
  }
  throw new Error('This photo could not be made small enough. Try a simpler image.');
}
