// One-off CSV import script: NWS Desktop Personas → Supabase `users` table.
// Reads the CSV and inserts each row as a Person, generating a UUID and
// mapping NWS column names to the project's user schema.
//
// Usage:  node scripts/import-personas-csv.mjs /path/to/La\ estacion\ NWS\ Desktop\ Personas\ \(1\).csv
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const envVars = {};
function loadEnv(path) {
  if (!existsSync(path)) return;
  const txt = readFileSync(path, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!envVars[m[1]]) envVars[m[1]] = val;
  }
}
loadEnv('.env');
loadEnv('.env.local');

const supabaseUrl = envVars.SUPABASE_URL || envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/import-personas-csv.js <csv-path>');
  process.exit(1);
}

// ─── CSV parser (no external lib) ────────────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let i = 0;
  let cur = '';
  let row = [];
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cur += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(cur); cur = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
      row = []; cur = ''; i++;
      if (c === '\r' && text[i] === '\n') i++;
      continue;
    }
    cur += c; i++;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const csv = readFileSync(csvPath, 'utf8');
const rows = parseCSV(csv).filter((r) => r.length > 1 || (r.length === 1 && r[0]));
const headers = rows[0];
const dataRows = rows.slice(1);
console.log(`Found ${dataRows.length} data rows, ${headers.length} columns`);

const byName = (row, name) => {
  const idx = headers.indexOf(name);
  if (idx < 0) return '';
  return (row[idx] || '').trim();
};
const bool = (v) => {
  const s = String(v || '').trim().toUpperCase();
  return s === 'TRUE' || s === 'YES' || s === '1' || s === 'Y';
};
const intOrNull = (v) => {
  const s = String(v || '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

// Map: NWS column → schema field
function mapRow(row) {
  const first_name = byName(row, 'FirstName') || null;
  const middle_name = byName(row, 'MiddleName') || null;
  const last_name = byName(row, 'LastName') || null;
  const display_name = byName(row, 'DisplayName') || null;
  const gender = byName(row, 'Gender').toLowerCase() === 'female' ? 'female' : 'male';

  // Phone: prefer Mobile > Home > Work
  const phone1 = byName(row, 'PhoneMobile') || byName(row, 'PhoneHome') || byName(row, 'PhoneWork') || null;
  const phone2 = byName(row, 'PhoneHome') || byName(row, 'PhoneWork') || null;
  const email1 = byName(row, 'Email') || null;
  const email2 = byName(row, 'Email2') || null;

  // Address: combine Address + lat/lng
  const address = byName(row, 'Address') || null;
  const lat = byName(row, 'Latitude');
  const lng = byName(row, 'Longitude');
  const lat_lng = lat && lng ? `${lat}, ${lng}` : (lat || lng || null);

  const date_of_birth = byName(row, 'DOB') || null;

  // Privilege: "PUB" → is_publisher
  const privilege = (byName(row, 'Privilege') || '').toUpperCase();
  const is_publisher = privilege === 'PUB' || privilege === 'AUXILIARY' || privilege === 'REGULAR' || privilege === 'SPECIAL' || privilege === 'PIONEER';

  const is_active = bool(byName(row, 'Active'));

  const useForChairman = bool(byName(row, 'UseForChairman'));
  const useForTreasuresTalk = bool(byName(row, 'UseForTreasuresTalk'));
  const useForTreasuresGems = bool(byName(row, 'UseForTreasuresGems'));
  const useForTreasuresBR = bool(byName(row, 'UseForTreasuresBR'));
  const useForApplyIC = bool(byName(row, 'UseForApplyIC'));
  const useForApplyRV = bool(byName(row, 'UseForApplyRV'));
  const useForApplyBS = bool(byName(row, 'UseForApplyBS'));
  const useForApplyExplaining = bool(byName(row, 'UseForApplyExplaining'));
  const useForApplyStudentTalk = bool(byName(row, 'UseForApplyStudentTalk'));
  const useForApplyAssistant = bool(byName(row, 'UseForApplyAssistant'));
  const useForPrayers = bool(byName(row, 'UseForPrayers'));
  const useForCBS = bool(byName(row, 'UseForCBS'));
  const useForCBSReader = bool(byName(row, 'UseForCBSReader'));
  const useForLivingParts = bool(byName(row, 'UseForLivingParts'));

  // Student parts = any of the apply-* types
  const can_do_student_parts = useForApplyIC || useForApplyRV || useForApplyBS || useForApplyExplaining || useForApplyStudentTalk;

  return {
    id: randomUUID(),
    first_name,
    middle_name,
    last_name,
    display_name: display_name || [first_name, middle_name, last_name].filter(Boolean).join(' '),
    phone1,
    phone2,
    address,
    lat_lng,
    email1,
    email2,
    gender,
    date_of_birth,
    is_active,
    is_publisher,
    is_elder: false,
    is_ministerial_servant: false,
    is_elderly: bool(byName(row, 'ElderlyInfirm')),
    is_infirm: bool(byName(row, 'ElderlyInfirm')),
    is_child: bool(byName(row, 'Child')),
    is_blind: bool(byName(row, 'Blind')),
    is_deaf: bool(byName(row, 'Deaf')),
    is_anointed: bool(byName(row, 'Anointed')),
    disable_app_access: bool(byName(row, 'DisableNWPAppAccess')),
    can_be_chairman: useForChairman,
    can_be_speaker: useForTreasuresTalk || bool(byName(row, 'PublicTalksCanGive')),
    can_do_gems: useForTreasuresGems,
    can_do_bible_reading: useForTreasuresBR,
    can_do_student_parts,
    can_be_assistant: useForApplyAssistant,
    can_do_prayers: useForPrayers,
    can_be_cbs_conducer: useForCBS || useForLivingParts,
    can_be_cbs_reader: useForCBSReader,
    family_id: null,
    is_family_head: false,
    notes: null,
    status: 'active',
    moved_date: null,
    moved_to_congregation: null,
    // Legacy required fields
    name: display_name || [first_name, middle_name, last_name].filter(Boolean).join(' '),
    email: email1 || `${(first_name || 'person').toLowerCase()}.${randomUUID().slice(0, 8)}@nws-import.local`,
  };
}

const persons = dataRows.map(mapRow);
console.log(`Mapped ${persons.length} persons`);
console.log('Sample:', JSON.stringify(persons[0], null, 2).slice(0, 600));

// Check for existing persons by display_name to avoid duplicates
const { data: existing, error: e1 } = await supabase
  .from('users')
  .select('id, display_name, name, email');
if (e1) { console.error('Read error:', e1); process.exit(1); }

const existingKeys = new Set();
for (const r of existing || []) {
  if (r.display_name) existingKeys.add(r.display_name);
  if (r.name) existingKeys.add(r.name);
  if (r.email) existingKeys.add(r.email);
}

const toInsert = persons.filter((p) => {
  if (existingKeys.has(p.display_name)) return false;
  if (existingKeys.has(p.name)) return false;
  if (existingKeys.has(p.email)) return false;
  return true;
});
const skipped = persons.length - toInsert.length;
console.log(`Will insert ${toInsert.length} new records (skipping ${skipped} duplicates)`);

if (toInsert.length === 0) {
  console.log('Nothing to insert.');
  process.exit(0);
}

// Insert in batches of 50
let inserted = 0;
let failed = 0;
for (let i = 0; i < toInsert.length; i += 50) {
  const batch = toInsert.slice(i, i + 50);
  const { data, error } = await supabase.from('users').insert(batch).select('id, display_name');
  if (error) {
    console.error(`Batch ${i}-${i + batch.length} error:`, error);
    failed += batch.length;
  } else {
    inserted += (data || []).length;
    console.log(`Inserted batch ${i}-${i + batch.length}: ${(data || []).length} rows`);
  }
}
console.log(`\nDone. Inserted: ${inserted}, Failed: ${failed}, Skipped (dup): ${skipped}`);
