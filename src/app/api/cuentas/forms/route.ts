import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { buildS30, buildS25c, serviceYearOf } from '@/lib/cuentas';
import { requireCuentas, badRequest, serverError } from '../_guard';

const YM = /^\d{4}-\d{2}$/;
const SY = /^\d{4}\/\d{4}$/;

/**
 * Genera el formulario oficial en PDF rellenando la plantilla de la
 * organización (AcroForm), no una recreación en HTML.
 *
 *   GET /api/cuentas/forms?kind=s30&ym=2026-07
 *   GET /api/cuentas/forms?kind=s25c&sy=2025/2026&quarter=4
 *   GET /api/cuentas/forms?kind=s30&ym=…&calibrate=1   ← cada casilla con su nombre
 *
 * `pdf-lib` se carga de forma diferida para que un despliegue sin la
 * dependencia instalada siga sirviendo el resto del módulo y devuelva aquí un
 * error explicable en vez de romper el arranque.
 */
export async function GET(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const p = new URL(request.url).searchParams;
    const kind = p.get('kind') || 's30';
    const calibrate = p.get('calibrate') === '1';

    if (!['s26', 's30', 's25c'].includes(kind)) return badRequest(`kind desconocido: ${kind}`);

    let pdfForms: typeof import('@/lib/pdfForms');
    try {
      pdfForms = await import('@/lib/pdfForms');
    } catch {
      return NextResponse.json({
        error: 'Falta la dependencia pdf-lib. Ejecuta: npm install',
      }, { status: 501 });
    }

    if (!pdfForms.templateExists(kind as 's26' | 's30' | 's25c')) {
      return NextResponse.json({
        error: `Falta la plantilla oficial de ${kind.toUpperCase()} en src/lib/pdf-templates/`,
      }, { status: 501 });
    }

    // Encabezado del formulario.
    const cfg = getDb().prepare(
      `SELECT label, city, state FROM cuentas_config WHERE congregation_id = ?`
    ).get(g.congreId) as { label: string; city: string; state: string } | undefined;

    const congre = getDb().prepare(
      `SELECT name, city FROM congregations WHERE id = ?`
    ).get(g.congreId) as { name: string; city: string | null } | undefined;

    const header = {
      label: cfg?.label || congre?.name || '',
      city:  cfg?.city  || congre?.city || '',
      state: cfg?.state || '',
    };

    let bytes: Uint8Array;
    let filename: string;

    if (kind === 's26') {
      const ym = p.get('ym');
      if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');
      const { buildS26 } = await import('@/lib/cuentas');
      bytes = await pdfForms.fillS26(buildS26(g.congreId, ym), header, { calibrate });
      filename = `S-26-S ${ym}${calibrate ? ' (calibracion)' : ''}.pdf`;
    } else if (kind === 's30') {
      const ym = p.get('ym');
      if (!ym || !YM.test(ym)) return badRequest('ym requerido (YYYY-MM)');
      bytes = await pdfForms.fillS30(buildS30(g.congreId, ym), header, { calibrate });
      filename = `S-30-S ${ym}${calibrate ? ' (calibracion)' : ''}.pdf`;
    } else {
      const quarter = Number(p.get('quarter') || 1);
      if (![1, 2, 3, 4].includes(quarter)) return badRequest('quarter debe ser 1, 2, 3 o 4');
      const ym = p.get('ym');
      const sy = p.get('sy') && SY.test(p.get('sy')!)
        ? p.get('sy')!
        : (ym && YM.test(ym) ? serviceYearOf(ym) : null);
      if (!sy) return badRequest('sy requerido (YYYY/YYYY)');
      bytes = await pdfForms.fillS25c(buildS25c(g.congreId, sy, quarter), header, { calibrate });
      filename = `S-25c ${sy.replace('/', '-')} T${quarter}${calibrate ? ' (calibracion)' : ''}.pdf`;
    }

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) { return serverError(e); }
}
