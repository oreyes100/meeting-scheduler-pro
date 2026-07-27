import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/sqlite';
import { runReceiptOcr } from '@/lib/receiptOcr';

/**
 * Agente de recibos por Telegram.
 *
 * Flujo: llega una foto al chat de la congregación → se descarga → se lee con
 * IA → se responde en el mismo chat con la propuesta y dos botones → si se
 * aprueba, se asientan las transacciones y se confirma.
 *
 * Decisión de diseño: la aprobación es obligatoria y ocurre en Telegram. Un
 * recibo mal leído que entra solo en la contabilidad es mucho peor que uno que
 * no entra, así que el agente propone pero nunca asienta por su cuenta.
 *
 * Seguridad: Telegram no autentica al llamante, así que la ruta exige el
 * secreto que se fija al registrar el webhook (cabecera
 * `X-Telegram-Bot-Api-Secret-Token`). Sin él, cualquiera podría inyectar
 * asientos. Además el chat debe estar dado de alta en `messaging_settings`,
 * que es lo que ata la conversación a una congregación concreta.
 */

const TG = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;
const FILE = (token: string, p: string) => `https://api.telegram.org/file/bot${token}/${p}`;

interface TgUpdate {
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; first_name?: string; username?: string };
    photo?: { file_id: string; file_size?: number }[];
    document?: { file_id: string; mime_type?: string; file_size?: number };
    caption?: string;
    text?: string;
  };
  callback_query?: {
    id: string;
    data: string;
    from: { id: number; first_name?: string; username?: string };
    message: { message_id: number; chat: { id: number } };
  };
}

interface Proposal {
  date: string; description: string; amount: number;
  kind: 'income' | 'expense'; code: string | null;
  receipt_ref: string | null; confidence: string;
  account: 'caja' | 'corriente' | 'sucursal';
}

async function tg(token: string, method: string, body: unknown) {
  const r = await fetch(TG(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

/** Congregación y credenciales asociadas a un chat de Telegram. */
function congregationForChat(chatId: string): { congregationId: string; token: string } | null {
  const row = getDb().prepare(`
    SELECT congregation_id, telegram_bot_token
    FROM messaging_settings
    WHERE telegram_chat_id = ? AND telegram_enabled = 1
  `).get(chatId) as { congregation_id: string; telegram_bot_token: string | null } | undefined;

  if (!row?.telegram_bot_token) return null;
  return { congregationId: row.congregation_id, token: row.telegram_bot_token };
}

const money = (n: number) => `$${n.toFixed(2)}`;

function renderProposal(rows: Proposal[]): string {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const lines = rows.map((r, i) =>
    `${i + 1}. <b>${r.description}</b>\n` +
    `   ${r.kind === 'income' ? 'Entrada' : 'Salida'} · ${r.code ?? 'sin código'} · ${r.date}\n` +
    `   ${money(r.amount)}${r.confidence === 'baja' ? '  ⚠️ <i>confianza baja, revisa la cantidad</i>' : ''}`
  ).join('\n');

  return `🧾 <b>Recibo leído</b>\n\n${lines}\n\n<b>Total: ${money(total)}</b>\n\n` +
         `¿Registro estas transacciones?`;
}

/* ── Webhook ────────────────────────────────────────────────────────────────── */

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[telegram] TELEGRAM_WEBHOOK_SECRET no configurado');
    return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET no configurado' }, { status: 501 });
  }

  const incoming = request.headers.get('x-telegram-bot-api-secret-token');
  if (incoming !== secret) {
    console.warn('[telegram] secret inválido:', { incoming: incoming?.slice(0, 4) + '…', expected: secret.slice(0, 4) + '…' });
    return new NextResponse(null, { status: 401 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch (e) {
    console.error('[telegram] no se pudo leer el body:', e);
    return NextResponse.json({ ok: true });
  }

  console.log('[telegram] update recibido:', body.slice(0, 500));

  try {
    const update: TgUpdate = JSON.parse(body);

    if (update.callback_query) return handleCallback(update.callback_query);
    if (update.message)        return handleMessage(update.message);

    console.log('[telegram] update sin message ni callback_query, ignorado');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[telegram] fallo procesando update:', e);
    return NextResponse.json({ ok: true });
  }
}

/* ── Mensaje con recibo ─────────────────────────────────────────────────────── */

async function handleMessage(msg: NonNullable<TgUpdate['message']>) {
  const chatId = String(msg.chat.id);
  console.log('[telegram] handleMessage chatId:', chatId,
    'text:', msg.text?.slice(0, 80), 'photo:', !!msg.photo, 'doc:', !!msg.document);

  const ctx = congregationForChat(chatId);
  if (!ctx) {
    console.warn('[telegram] chatId no vinculado:', chatId);
    try {
      const rows = getDb().prepare(
        `SELECT telegram_chat_id, telegram_enabled FROM messaging_settings`
      ).all() as { telegram_chat_id: string | null; telegram_enabled: number }[];
      console.warn('[telegram] registrados en messaging_settings:', JSON.stringify(rows));
    } catch {}
    return NextResponse.json({ ok: true });
  }

  const { token, congregationId } = ctx;
  console.log('[telegram] congregación encontrada:', congregationId);

  if (msg.text?.startsWith('/')) {
    await tg(token, 'sendMessage', {
      chat_id: chatId, parse_mode: 'HTML',
      text: '🧾 Envía la foto de un recibo y te propongo el asiento contable para que lo apruebes.',
    });
    return NextResponse.json({ ok: true });
  }

  // Se toma la foto de mayor resolución, o el documento si es imagen o PDF.
  const photo = msg.photo?.[msg.photo.length - 1];
  const doc = msg.document && /^(image\/|application\/pdf)/.test(msg.document.mime_type ?? '')
    ? msg.document : null;
  const fileId = photo?.file_id ?? doc?.file_id;
  console.log('[telegram] fileId:', fileId, 'mime:', doc?.mime_type);
  if (!fileId) return NextResponse.json({ ok: true });

  const size = photo?.file_size ?? doc?.file_size ?? 0;
  if (size > 8 * 1024 * 1024) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: 'El archivo supera los 8 MB.' });
    return NextResponse.json({ ok: true });
  }

  await tg(token, 'sendChatAction', { chat_id: chatId, action: 'typing' });

  // Descarga del archivo desde Telegram.
  const info = await tg(token, 'getFile', { file_id: fileId }) as { result?: { file_path?: string } };
  const filePath = info?.result?.file_path;
  console.log('[telegram] getFile result:', JSON.stringify(info).slice(0, 200));
  if (!filePath) {
    console.error('[telegram] no se obtuvo file_path de getFile:', JSON.stringify(info));
    await tg(token, 'sendMessage', { chat_id: chatId, text: 'No pude descargar el archivo.' });
    return NextResponse.json({ ok: true });
  }

  const bin = await fetch(FILE(token, filePath)).then(r => r.arrayBuffer());
  const mime = doc?.mime_type ?? 'image/jpeg';
  const dataUrl = `data:${mime};base64,${Buffer.from(bin).toString('base64')}`;
  console.log('[telegram] imagen descargada, mime:', mime, 'bytes:', bin.byteLength);

  // Lectura con IA: llamada directa al motor (no vía HTTP propio, que falla en producción).
  const db = getDb();
  const codes = db.prepare(
    `SELECT code, description, kind FROM cuentas_codes WHERE congregation_id = ? ORDER BY sort_order`
  ).all(congregationId) as { code: string; description: string; kind: string }[];

  const cfg = db.prepare(
    `SELECT ai_api_key FROM cuentas_config WHERE congregation_id = ?`
  ).get(congregationId) as { ai_api_key: string | null } | undefined;

  console.log('[telegram] codes count:', codes.length, 'hasAiKey:', !!(cfg?.ai_api_key || process.env.GEMINI_API_KEY));

  let ocrResult: Awaited<ReturnType<typeof runReceiptOcr>>;
  try {
    ocrResult = await runReceiptOcr(dataUrl, codes, cfg?.ai_api_key);
    console.log('[telegram] ocrResult:', JSON.stringify(ocrResult).slice(0, 300));
  } catch (e) {
    console.error('[telegram] runReceiptOcr threw:', e);
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: `Error inesperado al procesar el recibo: ${e instanceof Error ? e.message : String(e)}`,
    });
    return NextResponse.json({ ok: true });
  }

  if ('error' in ocrResult) {
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: `No pude leer el recibo: ${ocrResult.error}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (!ocrResult.transactions?.length) {
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: 'No reconocí ninguna transacción en esa imagen. Prueba con más luz o más cerca.',
    });
    return NextResponse.json({ ok: true });
  }

  const rows: Proposal[] = ocrResult.transactions.map(t => ({
    ...t, account: t.kind === 'expense' ? 'corriente' : 'caja',
  }));

  const id = randomUUID();
  getDb().prepare(`
    INSERT INTO cuentas_telegram_pending
      (id, congregation_id, chat_id, message_id, file_id, proposal, status)
    VALUES (?,?,?,?,?,?,'pending')
  `).run(id, congregationId, chatId, String(msg.message_id), fileId, JSON.stringify(rows));

  await tg(token, 'sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: renderProposal(rows),
    reply_to_message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Registrar', callback_data: `ok:${id}` },
        { text: '❌ Descartar', callback_data: `no:${id}` },
      ]],
    },
  });

  return NextResponse.json({ ok: true });
}

/* ── Aprobación o rechazo ───────────────────────────────────────────────────── */

async function handleCallback(cb: NonNullable<TgUpdate['callback_query']>) {
  const chatId = String(cb.message.chat.id);
  const ctx = congregationForChat(chatId);
  if (!ctx) return NextResponse.json({ ok: true });

  const { token, congregationId } = ctx;
  const [action, id] = cb.data.split(':');
  const db = getDb();

  const row = db.prepare(`
    SELECT id, proposal, status FROM cuentas_telegram_pending
    WHERE id = ? AND congregation_id = ?
  `).get(id, congregationId) as { proposal: string; status: string } | undefined;

  if (!row) {
    await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Propuesta no encontrada' });
    return NextResponse.json({ ok: true });
  }
  if (row.status !== 'pending') {
    await tg(token, 'answerCallbackQuery', {
      callback_query_id: cb.id, text: `Ya estaba ${row.status === 'approved' ? 'registrada' : 'descartada'}`,
    });
    return NextResponse.json({ ok: true });
  }

  const who = cb.from.username ? `@${cb.from.username}` : (cb.from.first_name ?? 'alguien');

  if (action === 'no') {
    db.prepare(`UPDATE cuentas_telegram_pending
                SET status='rejected', resolved_by=?, resolved_at=datetime('now') WHERE id=?`)
      .run(who, id);
    await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Descartado' });
    await tg(token, 'editMessageText', {
      chat_id: chatId, message_id: cb.message.message_id, parse_mode: 'HTML',
      text: `🗑 <b>Recibo descartado</b> por ${who}.`,
    });
    return NextResponse.json({ ok: true });
  }

  // Registro de las transacciones aprobadas.
  const rows: Proposal[] = JSON.parse(row.proposal);
  const ins = db.prepare(`
    INSERT INTO cuentas_transactions
      (id, date, type, account, to_account, code, description, amount,
       receipt_ref, notes, congregation_id)
    VALUES (?,?,?,?,NULL,?,?,?,?,?,?)
  `);

  try {
    db.transaction(() => {
      for (const r of rows) {
        ins.run(randomUUID(), r.date, r.kind, r.account, r.code, r.description,
                r.amount, r.receipt_ref, `Recibo aprobado en Telegram por ${who}`, congregationId);
      }
      db.prepare(`UPDATE cuentas_telegram_pending
                  SET status='approved', resolved_by=?, resolved_at=datetime('now') WHERE id=?`)
        .run(who, id);
    })();
  } catch (e) {
    db.prepare(`UPDATE cuentas_telegram_pending SET status='error' WHERE id=?`).run(id);
    await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Error al registrar' });
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: `No pude registrar el asiento: ${e instanceof Error ? e.message : 'error'}`,
    });
    return NextResponse.json({ ok: true });
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);
  await tg(token, 'answerCallbackQuery', { callback_query_id: cb.id, text: 'Registrado' });
  await tg(token, 'editMessageText', {
    chat_id: chatId, message_id: cb.message.message_id, parse_mode: 'HTML',
    text: `✅ <b>Registrado</b> por ${who}\n${rows.length} transacción(es) · <b>${money(total)}</b>`,
  });

  return NextResponse.json({ ok: true });
}

/** GET: diagnóstico de estado del bot. No expone tokens. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // ?webhook=1 → consultar getWebhookInfo al primer bot configurado
  if (searchParams.get('webhook') === '1') {
    try {
      const row = getDb().prepare(
        `SELECT telegram_bot_token FROM messaging_settings WHERE telegram_bot_token IS NOT NULL LIMIT 1`
      ).get() as { telegram_bot_token: string } | undefined;
      if (!row) return NextResponse.json({ error: 'No hay token configurado en messaging_settings' });
      const info = await fetch(`https://api.telegram.org/bot${row.telegram_bot_token}/getWebhookInfo`).then(r => r.json());
      return NextResponse.json(info);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // Diagnóstico general
  let settings: { telegram_chat_id: string | null; telegram_enabled: number; has_token: boolean }[] = [];
  try {
    const rows = getDb().prepare(
      `SELECT telegram_chat_id, telegram_enabled, telegram_bot_token FROM messaging_settings`
    ).all() as { telegram_chat_id: string | null; telegram_enabled: number; telegram_bot_token: string | null }[];
    settings = rows.map(r => ({
      telegram_chat_id: r.telegram_chat_id,
      telegram_enabled: r.telegram_enabled,
      has_token: !!r.telegram_bot_token,
    }));
  } catch {}

  return NextResponse.json({
    ok: true,
    env: {
      TELEGRAM_WEBHOOK_SECRET: !!process.env.TELEGRAM_WEBHOOK_SECRET,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    },
    messaging_settings: settings,
    hint: 'Añade ?webhook=1 para consultar getWebhookInfo directamente a Telegram.',
  });
}
