import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const sqlPath = path.resolve(process.cwd(), 'update_schema_congregation.sql');
    const raw = fs.readFileSync(sqlPath, 'utf8');
    return NextResponse.json({ sql: raw });
  } catch {
    return NextResponse.json({ sql: '' });
  }
}
