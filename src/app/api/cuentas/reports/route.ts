import { NextResponse } from 'next/server';
import {
  buildS26, buildS30, buildS25c, buildSummary, buildReconcile, serviceYearOf,
} from '@/lib/cuentas';
import { requireCuentas, badRequest, serverError } from '../_guard';

const YM = /^\d{4}-\d{2}$/;
const SY = /^\d{4}\/\d{4}$/;

/**
 * Punto único de reportes:
 *   ?kind=s26       &ym=YYYY-MM
 *   ?kind=s30       &ym=YYYY-MM
 *   ?kind=s25c      &sy=YYYY/YYYY&quarter=1..4
 *   ?kind=summary   &sy=YYYY/YYYY
 *   ?kind=reconcile &ym=YYYY-MM
 */
export async function GET(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const p = new URL(request.url).searchParams;
    const kind = p.get('kind') || 's26';
    const ym = p.get('ym');
    const sy = p.get('sy');

    const needYm = () => {
      if (!ym || !YM.test(ym)) throw new RangeError('ym requerido (YYYY-MM)');
      return ym;
    };
    const needSy = () => {
      if (sy && SY.test(sy)) return sy;
      if (ym && YM.test(ym)) return serviceYearOf(ym);
      throw new RangeError('sy requerido (YYYY/YYYY)');
    };

    switch (kind) {
      case 's26':
        return NextResponse.json({ s26: buildS26(g.congreId, needYm()) });

      case 's30':
        return NextResponse.json({ s30: buildS30(g.congreId, needYm()) });

      case 's25c': {
        const quarter = Number(p.get('quarter') || 1);
        if (![1, 2, 3, 4].includes(quarter)) return badRequest('quarter debe ser 1, 2, 3 o 4');
        return NextResponse.json({ s25c: buildS25c(g.congreId, needSy(), quarter) });
      }

      case 'summary':
        return NextResponse.json({ summary: buildSummary(g.congreId, needSy()) });

      case 'reconcile':
        return NextResponse.json({ reconcile: buildReconcile(g.congreId, needYm()) });

      default:
        return badRequest(`kind desconocido: ${kind}`);
    }
  } catch (e) {
    if (e instanceof RangeError) return badRequest(e.message);
    return serverError(e);
  }
}
