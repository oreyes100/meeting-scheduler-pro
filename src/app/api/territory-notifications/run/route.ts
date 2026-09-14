import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';
import { getMessagingSettings, notify, renderTemplate, DEFAULT_TEMPLATES } from '@/lib/messaging';

/**
 * Sends the two recurring territory reminders:
 *  - overdue: assigned more than `overdue_days` ago and still not finished
 *  - weekly:  a progress request, once per ISO week per assignment
 *
 * Both are deduped via `messages.dedupe_key`, so running this more often than
 * needed is harmless. Hit by Vercel Cron (GET with CRON_SECRET), or by a
 * signed-in user from the admin screen.
 */
async function run() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);

  const { data: terrRows } = await sb().from('territories').select('congregation_id');
  const congreIds = Array.from(
    new Set(((terrRows || []) as { congregation_id: string | null }[]).map(r => r.congregation_id)),
  );

  let overdueSent = 0;
  let weeklySent = 0;

  for (const congreId of congreIds) {
    const s = await getMessagingSettings(congreId);

    const base = sb()
      .from('territories')
      .select('id, number, name, assigned_to, visit_start, pairs_count')
      .not('assigned_to', 'is', null)
      .is('visit_end', null)
      .neq('status', 'completed');
    const { data: rows } = congreId
      ? await base.eq('congregation_id', congreId)
      : await base.is('congregation_id', null);

    const list = (rows || []) as {
      id: string; number: number | null; name: string; assigned_to: string;
      visit_start: string | null; pairs_count: number | null;
    }[];
    if (!list.length) continue;

    const ids = Array.from(new Set(list.map(t => t.assigned_to).filter(Boolean)));
    const names: Record<string, string> = {};
    if (ids.length) {
      const { data: us } = await sb().from('users').select('id, name').in('id', ids);
      for (const u of (us || []) as { id: string; name: string }[]) names[u.id] = u.name;
    }

    for (const t of list) {
      const label = `${t.number != null ? t.number + '. ' : ''}${t.name}`;
      const start = t.visit_start;
      const days = start ? Math.floor((Date.parse(iso) - Date.parse(start)) / 86_400_000) : 0;
      const vars = {
        nombre: names[t.assigned_to] ?? '',
        territorio: label,
        fecha: start ?? '',
        dias: String(days),
        parejas: t.pairs_count ? `Parejas asignadas: ${t.pairs_count}. ` : '',
      };

      // ── Overdue ────────────────────────────────────────────────────────
      if (s.notify_overdue && start && days >= s.overdue_days) {
        const sent = await notify({
          userId: t.assigned_to,
          congregationId: congreId,
          kind: 'territory_overdue',
          title: `Territorio ${label} pendiente`,
          body: renderTemplate(s.template_overdue || DEFAULT_TEMPLATES.overdue, vars),
          territoryId: t.id,
          dedupeKey: `overdue:${t.id}:${start}`,
        });
        if (sent) overdueSent++;
      }

      // ── Weekly progress request ────────────────────────────────────────
      if (s.notify_weekly_status && start) {
        const y = today.getUTCFullYear();
        const week = Math.floor(
          (Date.UTC(y, today.getUTCMonth(), today.getUTCDate()) - Date.UTC(y, 0, 1)) / 604_800_000,
        );
        const sent = await notify({
          userId: t.assigned_to,
          congregationId: congreId,
          kind: 'territory_weekly',
          title: `¿Cómo vas con el territorio ${label}?`,
          body: renderTemplate(s.template_weekly || DEFAULT_TEMPLATES.weekly, vars),
          territoryId: t.id,
          dedupeKey: `weekly:${t.id}:${start}:${y}-w${week}`,
        });
        if (sent) weeklySent++;
      }
    }
  }

  return { overdueSent, weeklySent };
}

async function handle(request: Request) {
  const ctx = await getSessionContext();
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret');
  const auth = request.headers.get('authorization');
  const cronOk = Boolean(secret) && (provided === secret || auth === `Bearer ${secret}`);
  if (!ctx.userId && !cronOk) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
