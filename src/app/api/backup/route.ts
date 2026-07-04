import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ZipArchive } from 'archiver';
import { PassThrough } from 'stream';
import { tablesForSections } from '@/lib/backupSections';
import { toCsv } from '@/lib/csv';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function fetchAllRows(table: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from(table).select('*');
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionsParam = searchParams.get('sections');
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'json';
    const sections = sectionsParam ? sectionsParam.split(',').filter(Boolean) : null;
    const tables = tablesForSections(sections);
    const stamp = new Date().toISOString().slice(0, 10);

    const dump: Record<string, unknown[]> = {};
    for (const table of tables) dump[table] = await fetchAllRows(table);

    if (format === 'json') {
      return new NextResponse(JSON.stringify(dump, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="respaldo-${stamp}.json"`,
        },
      });
    }

    // CSV: una sola tabla -> .csv plano; varias -> .zip con un .csv por tabla
    if (tables.length === 1) {
      const csv = toCsv(dump[tables[0]] as Record<string, unknown>[]);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${tables[0]}-${stamp}.csv"`,
        },
      });
    }

    const archive = new ZipArchive({ zlib: { level: 9 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);
    for (const table of tables) {
      archive.append(toCsv(dump[table] as Record<string, unknown>[]), { name: `${table}.csv` });
    }
    archive.finalize();

    const chunks: Buffer[] = [];
    for await (const chunk of passthrough) chunks.push(chunk as Buffer);
    const zipBuffer = Buffer.concat(chunks);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="respaldo-${stamp}.zip"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Backup failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
