import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';
import { getMessagingSettings, DEFAULT_TEMPLATES } from '@/lib/messaging';

/** Fields the congregation admin may edit. */
const EDITABLE = [
  'whatsapp_enabled', 'provider', 'phone_number_id', 'access_token', 'sender_label',
  'notify_on_assign', 'notify_overdue', 'overdue_days',
  'notify_weekly_status', 'weekly_status_dow',
  'template_assign', 'template_overdue', 'template_weekly',
] as const;

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const s = await getMessagingSettings(ctx.congreId ?? null);
    // Never leak the token back to the browser — only whether one is stored.
    const { access_token, ...safe } = s;
    return NextResponse.json({
      settings: { ...safe, has_access_token: Boolean(access_token) },
      defaults: DEFAULT_TEMPLATES,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const body = await request.json();

    const patch: Record<string, unknown> = {
      congregation_id: ctx.congreId ?? null,
      updated_at: new Date().toISOString(),
    };
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      // An empty access_token means "leave the stored one alone".
      if (key === 'access_token' && !body[key]) continue;
      const v = body[key];
      patch[key] = typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
    }

    const { error } = await sb().from('messaging_settings').upsert([patch], { onConflict: 'congregation_id' });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
