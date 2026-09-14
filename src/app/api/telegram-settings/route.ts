import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';
import { getTelegramSettings } from '@/lib/telegram';

const EDITABLE = [
  'telegram_enabled', 'telegram_bot_token', 'telegram_chat_id',
  'telegram_notify_on_assign', 'telegram_notify_overdue',
  'telegram_notify_weekly_status', 'telegram_weekly_dow',
] as const;

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const s = await getTelegramSettings(ctx.congreId ?? null);
    const { telegram_bot_token, ...safe } = s;
    return NextResponse.json({ settings: { ...safe, has_bot_token: Boolean(telegram_bot_token) } });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const body = await request.json() as Record<string, unknown>;

    const patch: Record<string, unknown> = {
      congregation_id: ctx.congreId ?? null,
      updated_at: new Date().toISOString(),
    };
    for (const key of EDITABLE) {
      if (!(key in body)) continue;
      if (key === 'telegram_bot_token' && !body[key]) continue;
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
