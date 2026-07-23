/**
 * Export all data from Supabase (PostgREST) → data/export/*.json
 * Run from project root: node scripts/export-supabase-to-sqlite.cjs
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * For password hashes (optional, recommended):
 *   SUPABASE_DB_URL  — Postgres connection string from Supabase Dashboard
 *                      → Settings → Database → Connection string (URI)
 *                      e.g. postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL       = process.env.SUPABASE_DB_URL; // optional

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const EXPORT_DIR = path.join(process.cwd(), 'data', 'export');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

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

async function fetchTable(table) {
  const PAGE = 1000;
  let rows = [];
  let offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Range-Unit': 'items',
        'Prefer': 'count=none',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${table}: HTTP ${res.status} — ${text}`);
    }
    const page = await res.json();
    rows = rows.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

async function exportBusinessData() {
  console.log('=== Exporting business data from PostgREST ===');
  for (const table of TABLES) {
    try {
      const rows = await fetchTable(table);
      const file = path.join(EXPORT_DIR, `${table}.json`);
      fs.writeFileSync(file, JSON.stringify(rows, null, 2));
      console.log(`  ${table}: ${rows.length} rows`);
    } catch (e) {
      console.warn(`  WARNING ${table}: ${e.message}`);
    }
  }
}

async function exportPasswords() {
  if (!DB_URL) {
    console.log('\n=== Password hash export SKIPPED (SUPABASE_DB_URL not set) ===');
    console.log('   To export passwords: add SUPABASE_DB_URL to .env.local');
    console.log('   Without it, users must reset passwords after migration.');
    return;
  }

  console.log('\n=== Exporting password hashes via direct Postgres connection ===');
  let pg;
  try { pg = require('pg'); } catch { console.error('  Install pg: npm i pg'); return; }
  const { Client } = pg;
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, email, encrypted_password FROM auth.users WHERE encrypted_password IS NOT NULL'
    );
    const file = path.join(EXPORT_DIR, 'auth_users.json');
    fs.writeFileSync(file, JSON.stringify(rows, null, 2));
    console.log(`  auth.users: ${rows.length} rows with password hashes`);
  } finally {
    await client.end();
  }
}

async function main() {
  await exportBusinessData();
  await exportPasswords();
  console.log(`\nExport complete → ${EXPORT_DIR}`);
  console.log('Next: node scripts/import-to-sqlite.cjs --yes');
}

main().catch(e => { console.error(e); process.exit(1); });
