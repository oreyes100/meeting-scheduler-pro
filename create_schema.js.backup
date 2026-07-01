import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from current working directory
dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const sql = `
  DROP TABLE IF EXISTS meeting_parts;
  DROP TABLE IF EXISTS meetings;
  DROP TABLE IF EXISTS users;
  CREATE TABLE users (
    id uuid PRIMARY KEY,
    username text NOT NULL
  );
  CREATE TABLE meetings (
    id uuid PRIMARY KEY,
    title text NOT NULL
  );
  CREATE TABLE meeting_parts (
    id uuid PRIMARY KEY,
    meeting_id uuid REFERENCES meetings(id),
    assigned_user_id uuid REFERENCES users(id)
  );
`;

async function run() {
  try {
    console.log('🔍 Executing run_sql...');
    const { data, error } = await supabase.rpc('run_sql', { sql });
    if (error) throw error;
    console.log('✅ Schema created via run_sql');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

run();