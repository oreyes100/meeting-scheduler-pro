import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const sqlPath = path.resolve(process.cwd(), 'update_schema_weekend.sql');
    const raw = fs.readFileSync(sqlPath, 'utf8');

    // Strip full-line comments first (otherwise statements starting with a
    // comment block get wrongly filtered out), then split on ';'.
    const sql = raw.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const errors: string[] = [];
    for (const stmt of statements) {
      const { error } = await supabase.rpc('pg_execute_sql', { sql: stmt });
      if (error && !error.message.includes('already exists') && !error.message.includes('duplicate')) {
        errors.push(`${stmt.slice(0, 60)}… → ${error.message}`);
      }
    }

    // Reload PostgREST schema cache so the new tables are visible immediately
    await supabase.rpc('pg_execute_sql', { sql: "NOTIFY pgrst, 'reload schema';" });

    if (errors.length > 0) {
      const permissionBlocked = errors.some(e =>
        e.includes('permission denied') || e.includes('must be owner'),
      );
      return NextResponse.json({
        success: false,
        permissionBlocked,
        message: permissionBlocked
          ? 'The service role cannot create tables. Copy the SQL below into the Supabase SQL Editor and run it.'
          : 'Some statements failed. Run update_schema_weekend.sql in the Supabase SQL Editor.',
        sql: raw,
        errors,
      }, { status: 207 });
    }

    return NextResponse.json({ success: true, message: 'Weekend schema applied.' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Migration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Expose the SQL so the UI can offer a copy-paste fallback
export async function GET() {
  try {
    const sqlPath = path.resolve(process.cwd(), 'update_schema_weekend.sql');
    const raw = fs.readFileSync(sqlPath, 'utf8');
    return NextResponse.json({ sql: raw });
  } catch {
    return NextResponse.json({ sql: '' });
  }
}
