import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getDb } from '@/lib/sqlite';

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
    return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET no configurado' }, { status: 501 });
  }
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    // Silencioso a propósito: no confirmar a un intruso que la ruta existe.
    return new NextResponse(null, { status: 401 });
  }

  try {
    const update: TgUpdate = await request.json();

    if (update.callback_query) return handleCallback(update.callback_query);
    if (update.message)        return handleMessage(update.message);

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Un error nunca debe hacer que Telegram reintente en bucle.
    console.error('[telegram] fallo procesando update:', e);
    return NextResponse.json({ ok: true });
  }
}

/* ── Mensaje con recibo ─────────────────────────────────────────────────────── */

async function handleMessage(msg: NonNullable<TgUpdate['message']>) {
  const chatId = String(msg.chat.id);
  const ctx = congregationForChat(chatId);

  if (!ctx) {
    // El chat no está vinculado: no se puede saber a qué congregación asentar.
    return NextResponse.json({ ok: true });
  }

  const { token, congregationId } = ctx;

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
  if (!filePath) {
    await tg(token, 'sendMessage', { chat_id: chatId, text: 'No pude descargar el archivo.' });
    return NextResponse.json({ ok: true });
  }

  const bin = await fetch(FILE(token, filePath)).then(r => r.arrayBuffer());
  const mime = doc?.mime_type ?? 'image/jpeg';
  const dataUrl = `data:${mime};base64,${Buffer.from(bin).toString('base64')}`;

  // Lectura con IA reutilizando el mismo motor que la interfaz web.
  const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
  const ocr = await fetch(`${origin}/api/cuentas/ocr/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env.TELEGRAM_WEBHOOK_SECRET! },
    body: JSON.stringify({ dataUrl, congregationId }),
  }).then(r => r.json()).catch(() => null) as { transactions?: Proposal[]; error?: string } | null;

  if (!ocr || ocr.error || !ocr.transactions?.length) {
    await tg(token, 'sendMessage', {
      chat_id: chatId,
      text: ocr?.error
        ? `No pude leer el recibo: ${ocr.error}`
        : 'No reconocí ninguna transacción en esa imagen. Prueba con más luz o más cerca.',
    });
    return NextResponse.json({ ok: true });
  }

  const rows: Proposal[] = ocr.transactions.map(t => ({
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

/** GET: comprobación rápida de que el webhook está desplegado. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: !!process.env.TELEGRAM_WEBHOOK_SECRET,
    hint: 'Registra el webhook con setWebhook y el mismo secret_token.',
  });
}
