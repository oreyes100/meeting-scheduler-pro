import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'msp.db');
const SCHEMA_PATH = path.join(process.cwd(), 'src', 'lib', 'schema.sql');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  _db.pragma('cache_size = -8000');  // 8 MB page cache
  _db.pragma('synchronous = NORMAL'); // safe with WAL

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  _db.exec(schema);

  // Runtime migrations for columns added after initial schema deployment
  const runMigrations = [
    `ALTER TABLE public_talk_outlines ADD COLUMN theme text`,
    // Territory extras
    `ALTER TABLE territories ADD COLUMN pairs_count integer`,
    `ALTER TABLE territories ADD COLUMN completion_hours real`,
    `ALTER TABLE territories ADD COLUMN completion_houses integer`,
    `ALTER TABLE territories ADD COLUMN last_notified_at text`,
    `ALTER TABLE territories ADD COLUMN last_weekly_at text`,
    `ALTER TABLE territory_assignments ADD COLUMN pairs_count integer`,
    `ALTER TABLE territory_assignments ADD COLUMN completion_hours real`,
    `ALTER TABLE territory_assignments ADD COLUMN completion_houses integer`,
  ];
  for (const sql of runMigrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  // Repair rows written before db.ts generated ids. `id text PRIMARY KEY` is not
  // auto-populated by SQLite and (outside STRICT tables) still accepts NULL, so
  // any route that inserted without an id produced colliding NULL-id rows.
  try {
    const tables = _db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    ).all() as { name: string }[];
    for (const { name } of tables) {
      const cols = _db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[];
      if (!cols.some(c => c.name === 'id')) continue;
      const orphans = _db.prepare(`SELECT rowid FROM "${name}" WHERE id IS NULL OR id = ''`).all() as { rowid: number }[];
      for (const { rowid } of orphans) {
        _db.prepare(`UPDATE "${name}" SET id = ? WHERE rowid = ?`).run(randomUUID(), rowid);
      }
    }
  } catch { /* best effort — never block startup */ }

  return _db;
}
