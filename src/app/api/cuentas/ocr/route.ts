import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { requireCuentas, badRequest, serverError } from '../_guard';

/**
 * Lectura de recibos con IA (Google Gemini).
 *
 * Recibe la imagen o el PDF de un recibo y devuelve una o varias transacciones
 * propuestas, que la interfaz muestra para revisar antes de registrar. Nunca
 * escribe: la captura la confirma una persona. Un recibo mal leído que entra
 * solo en la contabilidad es peor que no tener OCR.
 *
 * La clave vive en la variable de entorno GEMINI_API_KEY, nunca en el
 * repositorio ni en la base de datos.
 */

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

/** Límite de tamaño: 8 MB de archivo original. */
const MAX_BYTES = 8 * 1024 * 1024;

interface Extracted {
  date: string | null;
  description: string | null;
  amount: number | null;
  kind: 'income' | 'expense' | null;
  receipt_ref: string | null;
  confidence: 'alta' | 'media' | 'baja';
}

function buildPrompt(codes: { code: string; description: string; kind: string }[]) {
  const catalog = codes.map(c => `${c.code} (${c.kind}): ${c.description}`).join('\n');
  return `Eres el auxiliar del siervo de cuentas de una congregación de los Testigos de Jehová.
Analiza el recibo o comprobante de la imagen y extrae las transacciones que contiene.

Catálogo de códigos de transacción disponibles:
${catalog}

Devuelve ÚNICAMENTE un objeto JSON válido, sin texto alrededor y sin bloques de código, con esta forma:
{"transactions":[{"date":"YYYY-MM-DD","description":"texto breve","amount":123.45,"kind":"income"|"expense","code":"CÓDIGO o null","receipt_ref":"folio o null","confidence":"alta"|"media"|"baja"}]}

Reglas:
- "amount" siempre positivo, en números, sin símbolo de moneda ni separadores de miles.
- "date" en formato YYYY-MM-DD. Si el recibo no la trae, usa null.
- "kind" es "expense" para facturas, tickets y comprobantes de pago; "income" para donativos recibidos.
- "code" debe salir del catálogo de arriba; si ninguno encaja con claridad, usa null.
- "confidence" es "baja" si la cantidad está manuscrita o borrosa, "alta" si está impresa y es nítida.
- Si el documento contiene varias partidas, devuelve una entrada por cada una.
- Si no reconoces ninguna transacción, devuelve {"transactions":[]}.`;
}

export async function POST(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({
      error: 'Falta GEMINI_API_KEY en el servidor. Añádela a .env.local (local) o a ecosystem.config.cjs (VPS).',
      needsKey: true,
    }, { status: 501 });
  }

  try {
    const { dataUrl } = await request.json();
    if (!dataUrl || typeof dataUrl !== 'string') return badRequest('Falta la imagen');

    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return badRequest('Formato de imagen no reconocido');

    const [, mimeType, b64] = m;
    if (!/^(image\/(png|jpe?g|webp|heic)|application\/pdf)$/.test(mimeType)) {
      return badRequest(`Tipo no admitido: ${mimeType}`);
    }
    if (Buffer.byteLength(b64, 'base64') > MAX_BYTES) {
      return badRequest('El archivo supera los 8 MB');
    }

    const codes = getDb().prepare(
      `SELECT code, description, kind FROM cuentas_codes WHERE congregation_id = ? ORDER BY sort_order`
    ).all(g.congreId) as { code: string; description: string; kind: string }[];

    const res = await fetch(ENDPOINT(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: buildPrompt(codes) },
            { inline_data: { mime_type: mimeType, data: b64 } },
          ],
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // El mensaje de Google es útil: clave inválida, cuota agotada, etc.
      return NextResponse.json({
        error: `La lectura con IA falló (${res.status}). ${detail.slice(0, 300)}`,
      }, { status: 502 });
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let parsed: { transactions?: Extracted[] };
    try {
      // Por si el modelo envuelve el JSON en un bloque de código pese a la instrucción.
      parsed = JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim());
    } catch {
      return NextResponse.json({
        error: 'La IA no devolvió un JSON legible.',
        raw: text.slice(0, 500),
      }, { status: 502 });
    }

    const known = new Set(codes.map(c => c.code));
    const transactions = (parsed.transactions ?? [])
      .map(t => ({
        date: typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
          ? t.date : new Date().toISOString().slice(0, 10),
        description: String(t.description ?? '').slice(0, 200) || 'Sin descripción',
        amount: Number(t.amount) > 0 ? Math.round(Number(t.amount) * 100) / 100 : 0,
        kind: t.kind === 'income' ? 'income' : 'expense',
        code: (t as Extracted & { code?: string }).code && known.has(String((t as Extracted & { code?: string }).code).toUpperCase())
          ? String((t as Extracted & { code?: string }).code).toUpperCase() : null,
        receipt_ref: t.receipt_ref ? String(t.receipt_ref).slice(0, 60) : null,
        confidence: ['alta', 'media', 'baja'].includes(t.confidence as string) ? t.confidence : 'media',
      }))
      .filter(t => t.amount > 0);

    return NextResponse.json({ transactions, model: MODEL });
  } catch (e) { return serverError(e); }
}
