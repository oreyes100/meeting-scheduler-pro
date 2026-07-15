import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverContext';
import { sb } from '@/lib/crud';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    let query = sb()
      .from('users')
      .select('id, name, first_name, last_name, email1, auth_email, app_role, permissions, username, congregation_id')
      .order('last_name', { ascending: true });
    // Super-admin sees ALL users across congregations; regular admin sees own congregation
    if (!ctx.isSuperAdmin && ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ users: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { user_id, app_role, permissions, auth_email, username } = body;
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const { congregation_id } = body;
    const patch: Record<string, unknown> = {};
    if (app_role !== undefined) patch.app_role = app_role;
    if (permissions !== undefined) patch.permissions = permissions;
    if (auth_email !== undefined) patch.auth_email = auth_email ? String(auth_email).toLowerCase() : null;
    if (username !== undefined) patch.username = username ? String(username).toLowerCase() : null;
    if (congregation_id !== undefined) patch.congregation_id = congregation_id || null;

    const { error } = await sb().from('users').update(patch).eq('id', user_id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
