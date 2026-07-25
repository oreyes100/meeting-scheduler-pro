import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

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
  ];
  for (const sql of runMigrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  return _db;
}
