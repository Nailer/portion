import { afterEach, describe, expect, it, vi } from 'vitest';
import { Interface } from 'ethers';
import { PortionArtifact, type Deployment } from '@portion/sdk';
import { Indexer } from '../src/indexer';
import { openDb, getKv, setKv } from '../src/db';
import { buildApp } from '../src/app';
vi.mock('@portion/sdk', async original => ({ ...await original<object>(), storedInBlock: vi.fn(async () => []) }));
const deployment = { portion: '0x1111111111111111111111111111111111111111', deployedBlock: 10 } as Deployment;
const databases: ReturnType<typeof openDb>[] = [];
afterEach(() => { databases.forEach(db => db.close()); databases.length = 0; vi.restoreAllMocks(); });
function fixture(missingState = false) {
  const db = openDb(':memory:'); databases.push(db);
  const iface = new Interface(PortionArtifact.abi);
  const encoded = iface.encodeEventLog(iface.getEvent('RevenueDeposited')!, [0, deployment.portion, 100n, 1n, '0x' + '00'.repeat(32), true]);
  const record = { event: { data: [{ toHex: () => deployment.portion }, { toHex: () => encoded.data }, encoded.topics.map(topic => ({ toHex: () => topic }))] } };
  const api = { genesisHash: { toHex: () => '0xnetwork' }, rpc: { chain: {
    getFinalizedHead: vi.fn(async () => '0xfinal'), getHeader: vi.fn(async () => ({ number: { toNumber: () => 10 } })),
    getBlockHash: vi.fn(async () => ({ toHex: () => '0xblock' })), subscribeFinalizedHeads: vi.fn(async () => vi.fn()),
  } }, events: { revive: { ContractEmitted: { is: () => true } } },
    at: vi.fn(async () => { if (missingState) throw new Error('state discarded'); return { query: { system: { events: async () => [record] }, timestamp: { now: async () => 10000 } } }; }) } as any;
  return { api, db, indexer: new Indexer(api, db, deployment) };
}
describe('finalized event indexing', () => {
  it('replays blocks without duplicating revenue and persists the cursor atomically', async () => {
    const f = fixture(); await f.indexer.start();
    expect(f.api.rpc.chain.subscribeFinalizedHeads).toHaveBeenCalledTimes(1);
    expect(f.indexer.status()).toMatchObject({ ready: true, historyComplete: true, lastIndexed: 10 });
    expect(getKv(f.db, 'indexed_to')).toBe('10');
    await (f.indexer as any).indexBlock(10);
    expect(f.db.prepare('SELECT COUNT(*) AS count FROM events').get()).toMatchObject({ count: 1 });
  });
  it('rolls back events and the checkpoint together when persistence fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = fixture();
    f.db.exec("CREATE TRIGGER checkpoint_failure BEFORE INSERT ON kv WHEN NEW.k = 'indexed_to' BEGIN SELECT RAISE(ABORT, 'checkpoint unavailable'); END");
    await f.indexer.start();
    expect(f.indexer.status().ready).toBe(false);
    expect(f.db.prepare('SELECT COUNT(*) AS count FROM events').get()).toMatchObject({ count: 0 });
    expect(getKv(f.db, 'indexed_to')).toBeUndefined();
  });
  it('rejects a database from another chain', async () => {
    const f = fixture(); await f.indexer.start();
    const api = { ...f.api, genesisHash: { toHex: () => '0xother-network' } };
    await expect(new Indexer(api, f.db, deployment).start()).rejects.toThrow('different chain or contract');
  });
  it('does not skip pruned state or claim that incomplete history is ready', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = fixture(true); await f.indexer.start();
    expect(f.indexer.status()).toMatchObject({ ready: false, lastIndexed: 9, error: 'state discarded' });
    expect(getKv(f.db, 'indexed_to')).toBeUndefined();
  });
  it('refuses to certify legacy cursors that may contain skipped or provisional records', async () => {
    const f = fixture(); setKv(f.db, 'indexed_to', '10');
    const indexer = new Indexer(f.api, f.db, deployment);
    await expect(indexer.start()).rejects.toThrow('Legacy index');
    expect(indexer.status().ready).toBe(false);
  });
  it('keeps history unavailable through the API until finalized coverage is complete', async () => {
    const f = fixture();
    const app = buildApp({ api: f.api, db: f.db, deployment, startedAt: Date.now(), indexerStatus: () => f.indexer.status() });
    expect((await app.request('/api/activity')).status).toBe(503);
    expect((await app.request('/api/listings/0/revenue')).status).toBe(503);
    await f.indexer.start();
    const response = await app.request('/api/listings/0/revenue');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ amount: '100', kind: 'revenue' }]);
  });
});
