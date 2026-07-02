import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';

export async function GET() {
  try {
    const { data, error } = await sb()
      .from('users')
      .select('id, name, first_name, last_name, email1, auth_email, app_role, permissions')
      .order('last_name', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ users: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { user_id, app_role, permissions, auth_email } = body;
    if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (app_role !== undefined) patch.app_role = app_role;
    if (permissions !== undefined) patch.permissions = permissions;
    if (auth_email !== undefined) patch.auth_email = auth_email ? String(auth_email).toLowerCase() : null;

    const { error } = await sb().from('users').update(patch).eq('id', user_id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
