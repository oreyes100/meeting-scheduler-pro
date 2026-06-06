// seed_test_users.js
// Adds availability columns to the users table and creates test users with availability windows.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Note: ALTER TABLE via RPC is not supported in this Supabase project.
// Ensure the columns `available_start` and `available_end` already exist in the `users` table.
// If they do not, add them manually via the Supabase SQL editor.

async function upsertTestUsers() {
  const testUsers = [
    { name: 'Organizador Principal', email: 'test@example.com', available_start: '09:00', available_end: '17:00' },
    { name: 'Asistente A', email: 'assistantA@example.com', available_start: '08:00', available_end: '18:00' },
    { name: 'Asistente B', email: 'assistantB@example.com', available_start: '10:00', available_end: '15:00' },
    { name: 'Asistente C', email: 'assistantC@example.com', available_start: '08:00', available_end: '18:00' },
  ];

  const { data, error } = await supabase.from('users').upsert(testUsers, {
    onConflict: 'email',
    returning: 'minimal',
  });

  if (error) {
    console.error('❌ Error upserting test users:', error.message);
    process.exit(1);
  }
  console.log('✅ Test users upserted with availability windows');
}

upsertTestUsers();
