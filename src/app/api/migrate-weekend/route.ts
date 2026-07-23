import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    const db = getDb();
    const sqlPath = path.resolve(process.cwd(), 'update_schema_weekend.sql');
    const raw = fs.readFileSync(sqlPath, 'utf8');

    const sql = raw.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const errors: string[] = [];
    for (const stmt of statements) {
      try {
        db.exec(stmt);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('already exists') && !msg.includes('duplicate column')) {
          errors.push(`${stmt.slice(0, 60)}… → ${msg}`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors, sql: raw }, { status: 207 });
    }

    return NextResponse.json({ success: true, message: 'Weekend schema applied.' });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Migration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sqlPath = path.resolve(process.cwd(), 'update_schema_weekend.sql');
    const raw = fs.readFileSync(sqlPath, 'utf8');
    return NextResponse.json({ sql: raw });
  } catch {
    return NextResponse.json({ sql: '' });
  }
}
