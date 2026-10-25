import { list } from '@vercel/blob';

/** Never silently truncate a catalog or receipt collection to its first page. */
export async function storedObjects(prefix: string) {
  const blobs: Awaited<ReturnType<typeof list>>['blobs'] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    blobs.push(...result.blobs);
    if (!result.hasMore) return blobs;
    if (!result.cursor || cursors.has(result.cursor)) throw new Error('Public storage pagination did not advance.');
    cursor = result.cursor;
    cursors.add(cursor);
  }
  throw new Error('Public storage page budget exceeded; a complete response is unavailable.');
}

export async function storedJson<T>(prefix: string): Promise<T[]> {
  const blobs = await storedObjects(prefix);
  const rows: T[] = [];
  for (let offset = 0; offset < blobs.length; offset += 20) {
    rows.push(...await Promise.all(blobs.slice(offset, offset + 20).map(async blob => {
      const response = await fetch(blob.url);
      if (!response.ok) throw new Error('Public record unavailable.');
      return await response.json() as T;
    })));
  }
  return rows;
}
