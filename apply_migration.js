#!/usr/bin/env node
/**
 * Applies the CLM schema migration to Supabase using the REST SQL API.
 * Run with: node apply_migration.js
 */

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const SQL_API = `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`;

// We'll run each statement individually via fetch to the Management API
const stmts = [
  // --- users table extensions ---
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')) DEFAULT 'male'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_chairman BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_speaker BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_do_gems BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_do_bible_reading BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_do_student_parts BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_assistant BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_do_prayers BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_cbs_conducer BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_cbs_reader BOOLEAN DEFAULT FALSE`,

  // --- meetings table extensions ---
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS song_opening INTEGER`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS song_middle INTEGER`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS song_closing INTEGER`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS chairman_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS opening_prayer_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS closing_prayer_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS cbs_conducer_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS cbs_reader_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE`,

  // --- meeting_parts table extensions ---
  `ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS class_type TEXT CHECK (class_type IN ('main', 'aux_1', 'aux_2')) DEFAULT 'main'`,
  `ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS part_type TEXT DEFAULT 'student_part'`,
  `ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS part_number INTEGER`,
  `ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS title TEXT`,
  `ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 5`,
  `ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS assistant_user_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS study_point TEXT`,
  `ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS student_part_type TEXT`,

  // --- part_history table ---
  `CREATE TABLE IF NOT EXISTS part_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    part_type TEXT NOT NULL,
    assigned_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // --- indexes ---
  `CREATE INDEX IF NOT EXISTS idx_part_history_user_id ON part_history(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_part_history_assigned_date ON part_history(assigned_date)`,
  `CREATE INDEX IF NOT EXISTS idx_meeting_parts_meeting_id ON meeting_parts(meeting_id)`,
];

async function runSql(sql) {
  // Use Supabase Management API SQL endpoint
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    // Try the pg-meta endpoint instead
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Prefer': 'params=single-object',
      },
    });
    const text = await res.text();
    return { ok: false, error: text };
  }
  return { ok: true };
}

async function runViaPgDump(sql) {
  // Use the Supabase CLI pg connection or direct psql if available
  const { execSync } = require('child_process');
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) return null;
  try {
    execSync(`psql "${dbUrl}" -c "${sql.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('🚀 Applying CLM schema migration to Supabase...\n');

  // Try using @supabase/supabase-js with service role to run raw SQL via rpc
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let successCount = 0;
  let failCount = 0;

  for (const sql of stmts) {
    const shortSql = sql.replace(/\s+/g, ' ').substring(0, 80);
    try {
      // Try via Postgres function if exists, otherwise use direct REST
      const { error } = await sb.rpc('exec_sql', { sql });
      if (error) {
        // exec_sql RPC might not exist — try a workaround
        throw error;
      }
      console.log(`  ✅ ${shortSql}...`);
      successCount++;
    } catch (e) {
      // If exec_sql RPC doesn't exist, we need another approach
      console.log(`  ⚠️  RPC failed for: ${shortSql}...`);
      console.log(`     Error: ${e.message || e}`);
      failCount++;
    }
  }

  if (failCount > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  Some statements could not run via RPC.');
    console.log('   Please run the SQL manually in your Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/' + projectRef + '/sql');
    console.log('\n   Copy and paste the contents of: update_schema_clm.sql');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } else {
    console.log(`\n✅ Migration complete! ${successCount} statements applied.`);
  }

  // Verify the meetings table now has the expected columns
  console.log('\n🔍 Verifying meetings table columns...');
  const { data, error } = await sb.from('meetings').insert({ title: '__verify__', date: '2025-01-01', duration_minutes: 105, is_published: false }).select();
  if (error) {
    console.log('❌ Verification failed:', error.message);
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      console.log('\n👆 The migration has NOT been applied yet.');
      console.log('   Please manually run update_schema_clm.sql in the Supabase SQL Editor.');
    }
  } else {
    console.log('✅ meetings table columns:', Object.keys(data[0]).join(', '));
    // Clean up
    await sb.from('meetings').delete().eq('title', '__verify__');
  }
}

main().catch(console.error);
