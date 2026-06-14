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
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute each statement separately
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const errors: string[] = [];
    for (const stmt of statements) {
      const { error } = await supabase.rpc('pg_execute_sql', { sql: stmt });
      if (error && !error.message.includes('already exists') && !error.message.includes('duplicate')) {
        errors.push(`${stmt.slice(0, 60)}… → ${error.message}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Some statements failed. Try running update_schema_weekend.sql in the Supabase SQL Editor.',
        errors,
      }, { status: 207 });
    }

    return NextResponse.json({ success: true, message: 'Weekend schema applied.' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Migration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
