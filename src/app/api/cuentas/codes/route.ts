import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/sqlite';
import { DEFAULT_CODES, TYPES } from '@/lib/cuentas';
import { requireCuentas, badRequest, serverError } from '../_guard';

/** Siembra el catálogo estándar la primera vez que una congregación entra. */
function seed(congreId: string) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cuentas_codes (id, code, description, kind, sort_order, congregation_id)
    VALUES (?,?,?,?,?,?)
  `);
  for (const c of DEFAULT_CODES) {
    stmt.run(randomUUID(), c.code, c.description, c.kind, c.sort_order, congreId);
  }
}

export async function GET() {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const db = getDb();
    const q = `SELECT id, code, description, kind, sort_order
               FROM cuentas_codes WHERE congregation_id = ?
               ORDER BY sort_order ASC, code ASC`;

    let rows = db.prepare(q).all(g.congreId) as object[];
    if (rows.length === 0) {
      seed(g.congreId);
      rows = db.prepare(q).all(g.congreId) as object[];
    }
    return NextResponse.json({ codes: rows });
  } catch (e) { return serverError(e); }
}

export async function POST(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const { code, description, kind = 'income', sort_order = 99 } = await request.json();

    if (!code || !String(code).trim()) return badRequest('El código es obligatorio');
    if (!description || !String(description).trim()) return badRequest('La descripción es obligatoria');
    if (!(TYPES as readonly string[]).includes(kind)) return badRequest('Tipo inválido');

    const normalized = String(code).trim().toUpperCase();
    const db = getDb();

    const exists = db.prepare(
      `SELECT id FROM cuentas_codes WHERE congregation_id = ? AND code = ?`
    ).get(g.congreId, normalized);
    if (exists) return badRequest(`El código ${normalized} ya existe`);

    const id = randomUUID();
    db.prepare(`
      INSERT INTO cuentas_codes (id, code, description, kind, sort_order, congregation_id)
      VALUES (?,?,?,?,?,?)
    `).run(id, normalized, String(description).trim(), kind, Number(sort_order) || 99, g.congreId);

    return NextResponse.json({ code: db.prepare(`SELECT * FROM cuentas_codes WHERE id = ?`).get(id) });
  } catch (e) { return serverError(e); }
}

export async function PUT(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const { id, description, kind, sort_order } = await request.json();
    if (!id) return badRequest('id requerido');
    if (kind && !(TYPES as readonly string[]).includes(kind)) return badRequest('Tipo inválido');

    const result = getDb().prepare(`
      UPDATE cuentas_codes
      SET description = COALESCE(?, description),
          kind        = COALESCE(?, kind),
          sort_order  = COALESCE(?, sort_order)
      WHERE id = ? AND congregation_id = ?
    `).run(
      description ? String(description).trim() : null,
      kind ?? null,
      sort_order != null ? Number(sort_order) : null,
      id, g.congreId,
    );

    if (result.changes === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) { return serverError(e); }
}

export async function DELETE(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return badRequest('id requerido');

    const db = getDb();
    const row = db.prepare(
      `SELECT code FROM cuentas_codes WHERE id = ? AND congregation_id = ?`
    ).get(id, g.congreId) as { code: string } | undefined;
    if (!row) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    // No borrar un código en uso: dejaría transacciones sin clasificar y
    // descuadraría el desglose por código del S-30.
    const used = db.prepare(
      `SELECT COUNT(*) AS n FROM cuentas_transactions WHERE congregation_id = ? AND code = ?`
    ).get(g.congreId, row.code) as { n: number };

    if (used.n > 0) {
      return badRequest(`El código ${row.code} está usado en ${used.n} transacción(es); no se puede eliminar`);
    }

    db.prepare(`DELETE FROM cuentas_codes WHERE id = ? AND congregation_id = ?`).run(id, g.congreId);
    return NextResponse.json({ success: true });
  } catch (e) { return serverError(e); }
}
