import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated, canAccessCuentas } from '@/lib/serverContext';

const DEFAULT_CT_CODES = [
  { code: 'R1', description: 'Donaciones para la obra de la congregación', default_account: 'recibido', default_type: 'entrada', sort_order: 1 },
  { code: 'R2', description: 'Donaciones para la obra mundial', default_account: 'recibido', default_type: 'entrada', sort_order: 2 },
  { code: 'R3', description: 'Donaciones para el Salón del Reino', default_account: 'recibido', default_type: 'entrada', sort_order: 3 },
  { code: 'R4', description: 'Donaciones para gastos del circuito', default_account: 'recibido', default_type: 'entrada', sort_order: 4 },
  { code: 'R5', description: 'Otras donaciones', default_account: 'recibido', default_type: 'entrada', sort_order: 5 },
  { code: 'G1', description: 'Gastos de la congregación', default_account: 'principal', default_type: 'salida', sort_order: 6 },
  { code: 'G2', description: 'Contribución a la obra mundial (sucursal)', default_account: 'principal', default_type: 'salida', sort_order: 7 },
  { code: 'G3', description: 'Gastos del Salón del Reino (renta/servicios)', default_account: 'principal', default_type: 'salida', sort_order: 8 },
  { code: 'G4', description: 'Gastos del circuito', default_account: 'principal', default_type: 'salida', sort_order: 9 },
  { code: 'G5', description: 'Otros gastos', default_account: 'principal', default_type: 'salida', sort_order: 10 },
  { code: 'T1', description: 'Transferencia entre cuentas', default_account: 'recibido', default_type: 'transferencia', sort_order: 11 },
];

function seedDefaultCodes(congreId: string) {
  const db = getDb();
  for (const c of DEFAULT_CT_CODES) {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO cuentas_ct_codes (id, code, description, default_account, default_type, sort_order, congregation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(randomUUID(), c.code, c.description, c.default_account, c.default_type, c.sort_order, congreId);
    } catch { /* ignore */ }
  }
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!canAccessCuentas(ctx)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const db = getDb();
  let rows = db.prepare(
    `SELECT * FROM cuentas_ct_codes WHERE congregation_id = ? ORDER BY sort_order ASC, code ASC`
  ).all(ctx.congreId) as object[];

  if (rows.length === 0) {
    seedDefaultCodes(ctx.congreId!);
    rows = db.prepare(
      `SELECT * FROM cuentas_ct_codes WHERE congregation_id = ? ORDER BY sort_order ASC, code ASC`
    ).all(ctx.congreId) as object[];
  }

  return NextResponse.json({ ct_codes: rows });
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!canAccessCuentas(ctx)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const body = await request.json();
  const { code, description, default_account = 'principal', default_type = 'salida', sort_order = 99 } = body;
  if (!code || !description) return NextResponse.json({ error: 'code y description requeridos' }, { status: 400 });

  const db = getDb();
  const id = randomUUID();
  try {
    db.prepare(`
      INSERT INTO cuentas_ct_codes (id, code, description, default_account, default_type, sort_order, congregation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, code, description, default_account, default_type, sort_order, ctx.congreId);
    const row = db.prepare(`SELECT * FROM cuentas_ct_codes WHERE id = ?`).get(id);
    return NextResponse.json({ ct_code: row });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!canAccessCuentas(ctx)) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const db = getDb();
  const result = db.prepare(
    `DELETE FROM cuentas_ct_codes WHERE id = ? AND congregation_id = ?`
  ).run(id, ctx.congreId);

  if (result.changes === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}
