import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS docs (
      hash TEXT PRIMARY KEY,
      block INTEGER NOT NULL,
      idx INTEGER NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      renewed_block INTEGER,
      renewed_idx INTEGER
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      kind TEXT NOT NULL,
      listing_id INTEGER,
      actor TEXT,
      data TEXT NOT NULL,
      tx TEXT
    );
    CREATE INDEX IF NOT EXISTS events_listing ON events(listing_id, id);
    CREATE INDEX IF NOT EXISTS events_kind ON events(kind, id);
    CREATE TABLE IF NOT EXISTS samples (
      ts INTEGER PRIMARY KEY,
      best INTEGER, finalized INTEGER, validators INTEGER, era INTEGER,
      block_time REAL, peers INTEGER, mmr_leaves INTEGER, beefy_authorities INTEGER
    );
    CREATE TABLE IF NOT EXISTS drips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, address TEXT NOT NULL, ip TEXT, pot TEXT, pusd TEXT, tx TEXT
    );
    CREATE INDEX IF NOT EXISTS drips_addr ON drips(address, ts);
    CREATE TABLE IF NOT EXISTS keeper_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL, kind TEXT NOT NULL, ref TEXT, ok INTEGER NOT NULL, tx TEXT, detail TEXT
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      src_chain INTEGER NOT NULL, nonce TEXT NOT NULL, dst_chain INTEGER NOT NULL,
      sender TEXT NOT NULL, recipient TEXT NOT NULL, amount TEXT NOT NULL,
      src_tx TEXT, src_block INTEGER, status TEXT NOT NULL, dst_tx TEXT, error TEXT, ts INTEGER NOT NULL,
      UNIQUE(src_chain, nonce)
    );
    CREATE INDEX IF NOT EXISTS transfers_party ON transfers(sender, recipient);
    CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `);
  return db;
}

export const getKv = (db: DatabaseSync, k: string): string | undefined =>
  (db.prepare('SELECT v FROM kv WHERE k = ?').get(k) as { v: string } | undefined)?.v;

export const setKv = (db: DatabaseSync, k: string, v: string) =>
  db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, v);
