import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ALL_TABLES, primaryKeyOf } from '@/lib/backupSections';
import { parseCsv } from '@/lib/csv';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const CHUNK_SIZE = 500;

// Los CSV solo tienen strings; intenta recuperar el tipo real (número, bool, null, json)
function coerce(value: string): unknown {
  if (value === '') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
    try { return JSON.parse(value); } catch { /* keep as string */ }
  }
  return value;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function writeTable(table: string, rows: Record<string, unknown>[], mode: 'merge' | 'replace') {
  if (!ALL_TABLES.includes(table)) throw new Error(`Tabla no reconocida: ${table}`);
  const supabase = createClient(supabaseUrl, supabaseKey);
  const pk = primaryKeyOf(table);

  if (mode === 'replace') {
    const { error } = await supabase.from(table).delete().not(pk, 'is', null);
    if (error) throw new Error(`${table} (borrado): ${error.message}`);
  }
  if (rows.length === 0) return { table, rows: 0 };

  for (const batch of chunk(rows, CHUNK_SIZE)) {
    const { error } = mode === 'replace'
      ? await supabase.from(table).insert(batch)
      : await supabase.from(table).upsert(batch, { onConflict: pk });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return { table, rows: rows.length };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const mode = (form.get('mode') as string) === 'replace' ? 'replace' : 'merge';
    const confirm = (form.get('confirm') as string) || '';
    const targetTable = (form.get('table') as string) || '';

    if (!file) return NextResponse.json({ error: 'Falta el archivo de respaldo' }, { status: 400 });
    if (mode === 'replace' && confirm !== 'CONFIRMAR') {
      return NextResponse.json({ error: 'El modo de reemplazo total requiere escribir CONFIRMAR' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const text = await file.text();
    const results: { table: string; rows: number }[] = [];

    if (name.endsWith('.json')) {
      const dump = JSON.parse(text) as Record<string, Record<string, unknown>[]>;
      for (const table of Object.keys(dump)) {
        if (!ALL_TABLES.includes(table)) continue; // ignora claves desconocidas, no falla el restore completo
        results.push(await writeTable(table, dump[table], mode));
      }
    } else if (name.endsWith('.csv')) {
      if (!targetTable) return NextResponse.json({ error: 'Selecciona a qué tabla corresponde el CSV' }, { status: 400 });
      const rawRows = parseCsv(text);
      const rows = rawRows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, coerce(v)])));
      results.push(await writeTable(targetTable, rows, mode));
    } else {
      return NextResponse.json({ error: 'Formato no soportado — sube un .json o .csv' }, { status: 400 });
    }

    return NextResponse.json({ success: true, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Restore failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
