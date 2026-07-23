/**
 * Import exported JSON files → data/msp.db (SQLite)
 * Run: node scripts/import-to-sqlite.cjs --yes
 *
 * Requires:
 *   - data/export/*.json (from export-supabase-to-sqlite.cjs)
 *   - better-sqlite3 installed
 */
require('dotenv').config({ path: '.env.local' });
const fs   = require('fs');
const path = require('path');

const YES = process.argv.includes('--yes');
if (!YES) {
  console.log('Usage: node scripts/import-to-sqlite.cjs --yes');
  console.log('  --yes  clears existing data and imports from data/export/*.json');
  process.exit(0);
}

const Database = require('better-sqlite3');
const EXPORT_DIR = path.join(process.cwd(), 'data', 'export');
const DB_PATH    = process.env.DB_PATH || path.join(process.cwd(), 'data', 'msp.db');
const SCHEMA     = path.join(process.cwd(), 'src', 'lib', 'schema.sql');

if (!fs.existsSync(EXPORT_DIR)) { console.error('data/export/ not found. Run export first.'); process.exit(1); }

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // off during bulk import to avoid ordering issues

// Bootstrap schema
db.exec(fs.readFileSync(SCHEMA, 'utf8'));

// Import order — respects FK dependencies
const TABLES = [
  'congregations',
  'public_talk_outlines',
  'users',
  'public_speakers',
  'meetings',
  'meeting_parts',
  'part_history',
  'part_snapshots',
  'weekend_meetings',
  'public_talk_history',
  'congregation_settings',
  'territories',
  'field_service_groups',
  'field_service_group_members',
  'field_service_meetings',
  'pw_locations',
  'pw_shifts',
  'pw_assignments',
  'outgoing_talks',
  'congregation_tasks',
  'cleaning_assignments',
  'maintenance_tasks',
  'circuit_overseer_visits',
  'memorial_roles',
  'congregation_events',
  'congregation_roles',
  'field_service_reports',
  'meeting_attendance',
];

// JSON/array columns that need stringification
const JSON_COLS = {
  users: ['permissions'],
  public_speakers: ['outline_numbers'],
  territories: ['coordinates'],
  congregation_tasks: ['assignments'],
  cleaning_assignments: ['assignments'],
  maintenance_tasks: ['assigned_to'],
  circuit_overseer_visits: ['co_companions', 'wife_companions', 'activities'],
  memorial_roles: ['assigned_to'],
  congregations: ['enabled_modules'],
};

// Boolean columns that come as JS booleans and need 0/1 in SQLite
// (all others handled by generic bool→int coercion below)

function coerce(table, row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined || v === null) { out[k] = null; continue; }
    if (typeof v === 'boolean') { out[k] = v ? 1 : 0; continue; }
    const jsonCols = JSON_COLS[table] || [];
    if (jsonCols.includes(k) && typeof v !== 'string') { out[k] = JSON.stringify(v); continue; }
    if (Array.isArray(v)) { out[k] = JSON.stringify(v); continue; }
    out[k] = v;
  }
  return out;
}

function upsertRows(table, rows) {
  if (!rows.length) return 0;
  // Use INSERT OR REPLACE (replaces on PK conflict)
  const sample = coerce(table, rows[0]);
  const cols = Object.keys(sample);
  const sql = `INSERT OR REPLACE INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
  const stmt = db.prepare(sql);
  const run = db.transaction((rs) => { for (const r of rs) stmt.run(...cols.map(c => coerce(table, r)[c])); });
  run(rows);
  return rows.length;
}

// Merge password hashes from auth_users.json into users
function mergePasswords() {
  const authFile = path.join(EXPORT_DIR, 'auth_users.json');
  if (!fs.existsSync(authFile)) {
    console.log('  auth_users.json not found — passwords not migrated (users must reset via /api/permissions/set-password)');
    return;
  }
  const authUsers = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  const stmt = db.prepare(`UPDATE users SET password_hash = ? WHERE lower(auth_email) = ? OR lower(email) = ?`);
  let merged = 0;
  for (const au of authUsers) {
    if (!au.encrypted_password) continue;
    const email = (au.email || '').toLowerCase();
    const info = stmt.run(au.encrypted_password, email, email);
    if (info.changes > 0) merged++;
  }
  console.log(`  Passwords merged: ${merged} / ${authUsers.length}`);
}

console.log('=== Importing to SQLite ===');
console.log(`DB: ${DB_PATH}`);

// Clear all tables before import (idempotent)
const clearOrder = [...TABLES].reverse();
for (const t of clearOrder) { try { db.prepare(`DELETE FROM "${t}"`).run(); } catch {} }

let total = 0;
for (const table of TABLES) {
  const file = path.join(EXPORT_DIR, `${table}.json`);
  if (!fs.existsSync(file)) { console.log(`  ${table}: SKIP (no export file)`); continue; }
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const count = upsertRows(table, rows);
  console.log(`  ${table}: ${count} rows`);
  total += count;
}

mergePasswords();

db.pragma('foreign_keys = ON');
db.close();

console.log(`\nImport complete. Total rows: ${total}`);
console.log('Verify: node -e "const D=require(\'better-sqlite3\');const db=D(\'data/msp.db\');console.log(db.prepare(\'SELECT count(*) as n FROM users\').get())"');
