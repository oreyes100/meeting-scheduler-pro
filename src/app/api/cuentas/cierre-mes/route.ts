import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/sqlite';
import { buildS26, cierrePreview, cierreTag, monthLabel } from '@/lib/cuentas';
import { requireCuentas, badRequest, serverError } from '../_guard';

const YM = /^\d{4}-\d{2}$/;

/** GET: previsualización — qué asientos generaría el cierre, sin escribir nada. */
export async function GET(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const p = new URL(request.url).searchParams;
    const ym = p.get('ym');
    if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');

    const publishers = p.get('publishers') ? Number(p.get('publishers')) : null;

    const existing = getDb().prepare(`
      SELECT id, date, code, description, amount FROM cuentas_transactions
      WHERE congregation_id = ? AND receipt_ref = ?
      ORDER BY code
    `).all(g.congreId, cierreTag(ym)) as { id: string; amount: number }[];

    const preview = cierrePreview(g.congreId, ym, publishers);
    const s26 = buildS26(g.congreId, ym);

    return NextResponse.json({
      ym,
      monthLabel: monthLabel(ym),
      config: preview.config,
      entries: preview.entries,
      total: preview.total,
      alreadyClosed: existing.length > 0,
      existingEntries: existing,
      availableInMain: s26.closing.corriente,
      openingAudit: s26.openingAudit,
    });
  } catch (e) { return serverError(e); }
}

/**
 * POST: ejecuta el cierre del mes.
 *
 * Genera hasta tres asientos de salida desde la Cuenta Principal: la remesa de
 * obra mundial pendiente, la resolución mensual por publicador y la resolución
 * porcentual sobre las donaciones a la congregación.
 *
 * Es idempotente: los asientos llevan `receipt_ref = 'CIERRE-<ym>'`. Si ya hay
 * cierre, exige `correction: true` y entonces reemplaza los asientos previos en
 * vez de duplicarlos.
 */
export async function POST(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const { ym, publishers, correction } = await request.json();
    if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');

    const pubs = publishers != null && publishers !== '' ? Number(publishers) : null;
    if (pubs != null && (!Number.isFinite(pubs) || pubs < 0)) {
      return badRequest('El número de publicadores debe ser un entero no negativo');
    }

    const db = getDb();
    const ref = cierreTag(ym);

    const existing = db.prepare(
      `SELECT id FROM cuentas_transactions WHERE congregation_id = ? AND receipt_ref = ?`
    ).all(g.congreId, ref) as { id: string }[];

    if (existing.length > 0 && !correction) {
      return NextResponse.json({
        error: `Ya existe un cierre para ${monthLabel(ym)}. Envía correction: true para corregirlo.`,
        alreadyClosed: true,
      }, { status: 409 });
    }

    // Al corregir se retiran primero los asientos anteriores, para que el
    // recálculo parta del estado real del mes y no se acumule sobre sí mismo.
    const removed = existing.length;
    if (removed > 0) {
      db.prepare(
        `DELETE FROM cuentas_transactions WHERE congregation_id = ? AND receipt_ref = ?`
      ).run(g.congreId, ref);
    }

    const { entries, total, config } = cierrePreview(g.congreId, ym, pubs);

    if (entries.length === 0) {
      return NextResponse.json({
        success: true, removed, created: [], total: 0, config,
        message: `Sin movimientos de cierre para ${monthLabel(ym)}.`,
      });
    }

    // Los asientos se fechan el último día del mes.
    const [y, m] = ym.split('-').map(Number);
    const date = `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

    const insert = db.prepare(`
      INSERT INTO cuentas_transactions
        (id, date, type, account, to_account, code, description, amount,
         receipt_ref, notes, created_by, congregation_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const created: unknown[] = [];
    for (const e of entries) {
      const id = randomUUID();
      insert.run(
        id, date, 'expense', 'corriente', null, e.code, e.description, e.amount,
        ref, `${e.basis}${pubs != null ? ` · Publicadores: ${pubs}` : ''}`,
        g.userId, g.congreId,
      );
      created.push(db.prepare(`SELECT * FROM cuentas_transactions WHERE id = ?`).get(id));
    }

    return NextResponse.json({
      success: true, removed, created, total, config, publishers: pubs,
      message: `Cierre de ${monthLabel(ym)}: ${entries.length} asiento(s) por ${total.toFixed(2)}`,
    });
  } catch (e) { return serverError(e); }
}

/** DELETE: revierte el cierre de un mes (quita sus asientos generados). */
export async function DELETE(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const ym = new URL(request.url).searchParams.get('ym');
    if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');

    const r = getDb().prepare(
      `DELETE FROM cuentas_transactions WHERE congregation_id = ? AND receipt_ref = ?`
    ).run(g.congreId, cierreTag(ym));

    if (r.changes === 0) return NextResponse.json({ error: 'No había cierre para ese mes' }, { status: 404 });
    return NextResponse.json({ success: true, removed: r.changes });
  } catch (e) { return serverError(e); }
}
