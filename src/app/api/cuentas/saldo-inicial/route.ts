import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { openingBalance, openingAudit, carryForward } from '@/lib/cuentas';
import { requireCuentas, badRequest, serverError } from '../_guard';

const YM = /^\d{4}-\d{2}$/;

export async function GET(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const ym = new URL(request.url).searchParams.get('ym');
    if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');

    return NextResponse.json({
      ym,
      opening: openingBalance(g.congreId, ym),
      carried: carryForward(g.congreId, ym),
      audit: openingAudit(g.congreId, ym),
    });
  } catch (e) { return serverError(e); }
}

export async function PUT(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const { ym, caja, corriente, sucursal } = await request.json();
    if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');

    const nums = [caja, corriente, sucursal].map(Number);
    if (nums.some(n => !Number.isFinite(n))) return badRequest('Los tres saldos deben ser numéricos');

    getDb().prepare(`
      INSERT INTO cuentas_saldo_inicial (congregation_id, ym, caja, corriente, sucursal, updated_at)
      VALUES (?,?,?,?,?, datetime('now'))
      ON CONFLICT(congregation_id, ym) DO UPDATE SET
        caja = excluded.caja, corriente = excluded.corriente,
        sucursal = excluded.sucursal, updated_at = datetime('now')
    `).run(g.congreId, ym, nums[0], nums[1], nums[2]);

    // Se devuelve la auditoría para que la UI pueda avisar de inmediato si el
    // saldo declarado no cuadra con el arrastre real del mes anterior.
    return NextResponse.json({ success: true, audit: openingAudit(g.congreId, ym) });
  } catch (e) { return serverError(e); }
}

export async function DELETE(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const ym = new URL(request.url).searchParams.get('ym');
    if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');

    // Quitar el saldo declarado devuelve el mes al arrastre automático.
    const r = getDb().prepare(
      `DELETE FROM cuentas_saldo_inicial WHERE congregation_id = ? AND ym = ?`
    ).run(g.congreId, ym);

    if (r.changes === 0) return NextResponse.json({ error: 'No había saldo declarado' }, { status: 404 });
    return NextResponse.json({ success: true, opening: openingBalance(g.congreId, ym) });
  } catch (e) { return serverError(e); }
}
