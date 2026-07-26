import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/sqlite';
import { buildPlan, type Field } from '@/lib/csvImport';
import { requireCuentas, badRequest, serverError } from '../_guard';

/** Marca de los asientos traídos por importación, para poder revertirla. */
const IMPORT_TAG = 'IMPORT';

/**
 * Importa el respaldo CSV del programa legacy.
 *
 * `dryRun: true` valida y devuelve el plan sin escribir. La UI siempre hace la
 * pasada en seco primero: importar datos contables a ciegas no es recuperable
 * salvo por el revert, y es mejor ver los errores antes.
 */
export async function POST(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const { data, mapping, hasHeader = true, dryRun = true, skipInvalid = false, batchId } = await request.json();

    if (!Array.isArray(data) || data.length === 0) return badRequest('CSV vacío');
    if (!Array.isArray(mapping)) return badRequest('mapping requerido');

    const db = getDb();

    const known = new Set(
      (db.prepare(`SELECT code FROM cuentas_codes WHERE congregation_id = ?`)
         .all(g.congreId) as { code: string }[]).map(r => r.code)
    );

    const plan = buildPlan(data as string[][], mapping as Field[], hasHeader, known);

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        willImport: plan.rows.length,
        issues: plan.issues,
        newCodes: plan.newCodes,
        months: plan.months,
        totals: plan.totals,
        sample: plan.rows.slice(0, 10),
      });
    }

    if (plan.issues.length > 0 && !skipInvalid) {
      return NextResponse.json({
        error: `${plan.issues.length} fila(s) con errores. Corrige el CSV o marca «omitir filas inválidas».`,
        issues: plan.issues,
      }, { status: 400 });
    }

    if (plan.rows.length === 0) return badRequest('No hay filas válidas para importar');

    const ref = `${IMPORT_TAG}-${batchId || new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}`;

    // Los códigos nuevos se crean conservando la descripción del CSV: el código
    // gobierna los reportes y debe existir para que el desglose del S-30 cuadre.
    const insertCode = db.prepare(`
      INSERT OR IGNORE INTO cuentas_codes (id, code, description, kind, sort_order, congregation_id)
      VALUES (?,?,?,?,?,?)
    `);
    for (const c of plan.newCodes) {
      const kind = plan.rows.find(r => r.code === c.code)?.type ?? 'income';
      insertCode.run(randomUUID(), c.code, c.description.slice(0, 120), kind, 50, g.congreId);
    }

    const insertTx = db.prepare(`
      INSERT INTO cuentas_transactions
        (id, date, type, account, to_account, code, description, amount,
         receipt_ref, notes, created_by, congregation_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    // Una sola transacción: o entra el respaldo completo o no entra nada.
    const run = db.transaction((rows: typeof plan.rows) => {
      for (const r of rows) {
        insertTx.run(
          randomUUID(), r.date, r.type, r.account, r.to_account, r.code,
          r.description, r.amount,
          r.receipt_ref || ref,
          r.notes, g.userId, g.congreId,
        );
      }
    });
    run(plan.rows);

    return NextResponse.json({
      success: true,
      imported: plan.rows.length,
      skipped: plan.issues.length,
      newCodes: plan.newCodes.map(c => c.code),
      months: plan.months,
      totals: plan.totals,
      batchRef: ref,
    });
  } catch (e) { return serverError(e); }
}
