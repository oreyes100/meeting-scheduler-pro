import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/sqlite';
import { buildS26, s25cOmPending, monthLabel, OM_REMIT_CODES } from '@/lib/cuentas';
import { requireCuentas, badRequest, serverError } from '../_guard';

const YM = /^\d{4}-\d{2}$/;
/** Marca que identifica los asientos generados por el cierre de un mes. */
const tag = (ym: string) => `CIERRE-${ym}`;

/** GET: previsualización — qué haría el cierre, sin escribir nada. */
export async function GET(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const ym = new URL(request.url).searchParams.get('ym');
    if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');

    const existing = getDb().prepare(`
      SELECT id, date, code, description, amount FROM cuentas_transactions
      WHERE congregation_id = ? AND receipt_ref = ?
    `).all(g.congreId, tag(ym)) as { id: string; amount: number }[];

    const s26 = buildS26(g.congreId, ym);

    return NextResponse.json({
      ym,
      monthLabel: monthLabel(ym),
      /** Donaciones de obra mundial recibidas y aún no remesadas. */
      omPending: s25cOmPending(g.congreId, ym),
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
 * Genera la remesa de obra mundial (código SOM) desde la Cuenta Principal por el
 * importe de donaciones OM recibidas y no remesadas en el mes.
 *
 * Es idempotente: los asientos se marcan con `receipt_ref = 'CIERRE-<ym>'`. Si ya
 * existe un cierre, exige `correction: true`, y en ese caso reemplaza los
 * asientos previos en lugar de duplicarlos.
 */
export async function POST(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const { ym, publishers, correction } = await request.json();
    if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');

    const db = getDb();
    const ref = tag(ym);

    const existing = db.prepare(
      `SELECT id FROM cuentas_transactions WHERE congregation_id = ? AND receipt_ref = ?`
    ).all(g.congreId, ref) as { id: string }[];

    if (existing.length > 0 && !correction) {
      return NextResponse.json({
        error: `Ya existe un cierre para ${monthLabel(ym)}. Envía correction: true para corregirlo.`,
        alreadyClosed: true,
      }, { status: 409 });
    }

    const pending = s25cOmPending(g.congreId, ym);

    // Al corregir, primero se retiran los asientos del cierre anterior para que
    // `pending` se recalcule sobre el estado real del mes.
    const removed = existing.length;
    if (existing.length > 0) {
      db.prepare(
        `DELETE FROM cuentas_transactions WHERE congregation_id = ? AND receipt_ref = ?`
      ).run(g.congreId, ref);
    }

    const recomputed = s25cOmPending(g.congreId, ym);

    if (recomputed <= 0) {
      return NextResponse.json({
        success: true,
        removed,
        created: [],
        message: `Sin donaciones de obra mundial pendientes de remesar en ${monthLabel(ym)}.`,
        publishers: publishers ?? null,
      });
    }

    // Último día del mes: la remesa se asienta con fecha de cierre.
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const date = `${ym}-${String(lastDay).padStart(2, '0')}`;

    const id = randomUUID();
    db.prepare(`
      INSERT INTO cuentas_transactions
        (id, date, type, account, to_account, code, description, amount,
         receipt_ref, notes, created_by, congregation_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, date, 'expense', 'corriente', null, OM_REMIT_CODES[0],
      'Remesa de donaciones para la obra mundial — cierre de mes',
      recomputed, ref,
      publishers != null ? `Publicadores informados: ${publishers}` : null,
      g.userId, g.congreId,
    );

    const created = db.prepare(`SELECT * FROM cuentas_transactions WHERE id = ?`).get(id);

    return NextResponse.json({
      success: true,
      removed,
      created: [created],
      pendingBefore: pending,
      remitted: recomputed,
      publishers: publishers ?? null,
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
    ).run(g.congreId, tag(ym));

    if (r.changes === 0) return NextResponse.json({ error: 'No había cierre para ese mes' }, { status: 404 });
    return NextResponse.json({ success: true, removed: r.changes });
  } catch (e) { return serverError(e); }
}
