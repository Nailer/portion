import { afterEach, describe, expect, it, vi } from 'vitest';
import { list } from '@vercel/blob';
import { storedJson, storedObjects } from '../src/blob-pages';
vi.mock('@vercel/blob', () => ({ list: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });
describe('durable collection pagination', () => {
  it('follows opaque cursors and includes later records', async () => {
    vi.mocked(list).mockResolvedValueOnce({ hasMore: true, cursor: 'next', blobs: [{ url: 'https://fixture/1' }] } as any)
      .mockResolvedValueOnce({ hasMore: false, blobs: [{ url: 'https://fixture/2' }] } as any);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ source: url }))));
    expect(await storedJson('receipts/')).toEqual([{ source: 'https://fixture/1' }, { source: 'https://fixture/2' }]);
    expect(list).toHaveBeenLastCalledWith({ prefix: 'receipts/', limit: 1000, cursor: 'next' });
  });
  it('fails visibly when a cursor repeats or a later record is unavailable', async () => {
    vi.mocked(list).mockResolvedValue({ hasMore: true, cursor: 'stuck', blobs: [] } as any);
    await expect(storedObjects('receipts/')).rejects.toThrow('did not advance');
    vi.mocked(list).mockResolvedValueOnce({ hasMore: false, blobs: [{ url: 'https://fixture/missing' }] } as any);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(storedJson('receipts/')).rejects.toThrow('unavailable');
  });
});
