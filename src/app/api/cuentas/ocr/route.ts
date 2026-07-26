import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { runReceiptOcr } from '@/lib/receiptOcr';
import { requireCuentas, badRequest, serverError } from '../_guard';

/**
 * Lectura de recibos con IA desde la interfaz web.
 *
 * Devuelve transacciones propuestas; no escribe nada. La captura la confirma
 * una persona: un recibo mal leído que entra solo en la contabilidad es peor
 * que no tener OCR.
 */
export async function POST(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      error: 'Falta GEMINI_API_KEY en el servidor. Añádela a .env.local (local) o a ecosystem.config.cjs (VPS).',
      needsKey: true,
    }, { status: 501 });
  }

  try {
    const { dataUrl } = await request.json();
    if (!dataUrl || typeof dataUrl !== 'string') return badRequest('Falta la imagen');

    const codes = getDb().prepare(
      `SELECT code, description, kind FROM cuentas_codes WHERE congregation_id = ? ORDER BY sort_order`
    ).all(g.congreId) as { code: string; description: string; kind: string }[];

    const out = await runReceiptOcr(dataUrl, codes);
    if ('error' in out) return NextResponse.json(out, { status: 502 });
    return NextResponse.json(out);
  } catch (e) { return serverError(e); }
}
