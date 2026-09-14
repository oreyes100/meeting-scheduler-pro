import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';

/** Inbox for the signed-in user, newest first. `?all=1` returns the congregation log. */
export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const all = new URL(request.url).searchParams.get('all') === '1';

    let rows: Record<string, unknown>[] = [];
    if (all) {
      const scoped = sb().from('messages').select('*').order('created_at', { ascending: false }).limit(200);
      const { data, error } = ctx.congreId
        ? await scoped.eq('congregation_id', ctx.congreId)
        : await scoped.is('congregation_id', null);
      if (error) throw error;
      rows = (data || []) as Record<string, unknown>[];
    } else {
      const { data, error } = await sb()
        .from('messages')
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      rows = (data || []) as Record<string, unknown>[];
    }

    const { data: unreadRows } = await sb()
      .from('messages')
      .select('id')
      .eq('user_id', ctx.userId)
      .is('read_at', null);
    const unread = (unreadRows || []).length;

    return NextResponse.json({ messages: rows, unread });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}

/** Mark messages read. Body: { ids: string[] } or { all: true }. */
export async function PATCH(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const body = await request.json();
    const now = new Date().toISOString();

    if (body.all) {
      const { error } = await sb()
        .from('messages')
        .update({ read_at: now })
        .eq('user_id', ctx.userId)
        .is('read_at', null);
      if (error) throw error;
    } else if (Array.isArray(body.ids) && body.ids.length) {
      const { error } = await sb()
        .from('messages')
        .update({ read_at: now })
        .eq('user_id', ctx.userId)
        .in('id', body.ids);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 });
  }
}
