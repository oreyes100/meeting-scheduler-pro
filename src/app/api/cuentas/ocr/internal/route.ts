import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { runReceiptOcr } from '@/lib/receiptOcr';

/**
 * Lectura de recibos para procesos internos (el agente de Telegram).
 *
 * No hay sesión de usuario detrás de un webhook, así que se autentica con el
 * mismo secreto del webhook y la congregación viaja en el cuerpo. Nunca debe
 * exponerse públicamente: sin el secreto, cualquiera podría gastar la cuota de
 * IA y leer el catálogo de códigos de cualquier congregación.
 */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get('x-internal-secret') !== secret) {
    return new NextResponse(null, { status: 401 });
  }

  try {
    const { dataUrl, congregationId } = await request.json();
    if (!dataUrl || !congregationId) {
      return NextResponse.json({ error: 'dataUrl y congregationId requeridos' }, { status: 400 });
    }

    const codes = getDb().prepare(
      `SELECT code, description, kind FROM cuentas_codes WHERE congregation_id = ? ORDER BY sort_order`
    ).all(congregationId) as { code: string; description: string; kind: string }[];

    return NextResponse.json(await runReceiptOcr(dataUrl, codes));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
