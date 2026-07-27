/**
 * Motor de lectura de recibos con IA (Google Gemini). SOLO SERVIDOR.
 *
 * Compartido por la interfaz web (`/api/cuentas/ocr`) y por el agente de
 * Telegram (`/api/cuentas/ocr/internal`): una sola implementación evita que
 * ambos caminos interpreten los recibos de forma distinta.
 *
 * La clave vive en GEMINI_API_KEY, nunca en el repositorio ni en la base.
 */

const MODEL = 'gemini-2.0-flash';
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

/** Límite de tamaño del archivo original. */
export const MAX_BYTES = 8 * 1024 * 1024;

export interface CodeRow { code: string; description: string; kind: string }

export interface ReceiptTx {
  date: string;
  description: string;
  amount: number;
  kind: 'income' | 'expense';
  code: string | null;
  receipt_ref: string | null;
  confidence: 'alta' | 'media' | 'baja';
}

function buildPrompt(codes: CodeRow[]) {
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

/** Lee un recibo y devuelve transacciones propuestas. Nunca escribe en la base. */
export async function runReceiptOcr(
  dataUrl: string, codes: CodeRow[], apiKey?: string | null,
): Promise<{ transactions: ReceiptTx[]; model: string } | { error: string }> {
  // La clave puede venir de la configuración de la congregación (editable desde
  // la interfaz) o del entorno. Se prefiere la de la congregación para que cada
  // una pueda usar su propia cuota sin tocar el servidor.
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return { error: 'Falta la clave de IA. Añádela en Cuentas → Configuración → Lectura de recibos.' };
  }

  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return { error: 'Formato de imagen no reconocido' };

  const [, mimeType, b64] = m;
  if (!/^(image\/(png|jpe?g|webp|heic)|application\/pdf)$/.test(mimeType)) {
    return { error: `Tipo no admitido: ${mimeType}` };
  }
  if (Buffer.byteLength(b64, 'base64') > MAX_BYTES) return { error: 'El archivo supera los 8 MB' };

  const res = await fetch(ENDPOINT(key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: buildPrompt(codes) },
        { inline_data: { mime_type: mimeType, data: b64 } },
      ] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { error: `La lectura con IA falló (${res.status}). ${detail.slice(0, 300)}` };
  }

  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  let parsed: { transactions?: Record<string, unknown>[] };
  try {
    parsed = JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim());
  } catch {
    return { error: 'La IA no devolvió un JSON legible.' };
  }

  const known = new Set(codes.map(c => c.code));
  const transactions: ReceiptTx[] = (parsed.transactions ?? [])
    .map(t => {
      const code = t.code ? String(t.code).toUpperCase() : null;
      const conf = String(t.confidence);
      return {
        date: typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
          ? t.date : new Date().toISOString().slice(0, 10),
        description: String(t.description ?? '').slice(0, 200) || 'Sin descripción',
        amount: Number(t.amount) > 0 ? Math.round(Number(t.amount) * 100) / 100 : 0,
        kind: t.kind === 'income' ? 'income' as const : 'expense' as const,
        code: code && known.has(code) ? code : null,
        receipt_ref: t.receipt_ref ? String(t.receipt_ref).slice(0, 60) : null,
        confidence: (['alta', 'media', 'baja'].includes(conf) ? conf : 'media') as ReceiptTx['confidence'],
      };
    })
    .filter(t => t.amount > 0);

  return { transactions, model: MODEL };
}
