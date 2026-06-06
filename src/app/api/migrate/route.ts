import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureRpc(supabase: any) {
  const sql = `
    CREATE OR REPLACE FUNCTION pg_execute_sql(sql TEXT) RETURNS VOID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$;`;
  try {
    // Drop first so the SECURITY DEFINER / search_path change takes effect
    await supabase.rpc('pg_execute_sql', { sql: 'DROP FUNCTION IF EXISTS pg_execute_sql(TEXT);' });
  } catch (_e) {
    // ignore
  }
  try {
    await supabase.rpc('pg_execute_sql', { sql });
  } catch (_e) {
    // ignore
  }
}

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ensure RPC is present (idempotent)
    await ensureRpc(supabase);

    // Load migration script from repository
    const sqlPath = path.resolve(process.cwd(), 'update_schema_clm.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration via the RPC
    const { error } = await supabase.rpc('pg_execute_sql', { sql });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Migration applied. Refresh /persons to see the new fields.',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Migration failed';
    const hint = message.includes('must be owner of table')
      ? ' The service role key cannot ALTER tables it does not own. Open the Supabase SQL Editor (https://supabase.com/dashboard) and paste the contents of update_schema_clm.sql into a new query, then click Run. Then refresh /persons.'
      : '';
    console.error('Migration error', e);
    return NextResponse.json({ error: message + hint }, { status: 500 });
  }
}
