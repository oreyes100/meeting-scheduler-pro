import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionContext } from '@/lib/serverContext';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const USER_FIELDS = 'id, first_name, last_name, display_name';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('congregation_roles').select(`role_key, label, custom_label, updated_at, person:person_id(${USER_FIELDS}), assistant_1:assistant_1_id(${USER_FIELDS}), assistant_2:assistant_2_id(${USER_FIELDS})`);
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ roles: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch roles';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { role_key, person_id, assistant_1_id, assistant_2_id, custom_label } = body;
    if (!role_key) return NextResponse.json({ error: 'role_key is required' }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('person_id' in body) patch.person_id = person_id || null;
    if ('assistant_1_id' in body) patch.assistant_1_id = assistant_1_id || null;
    if ('assistant_2_id' in body) patch.assistant_2_id = assistant_2_id || null;
    if ('custom_label' in body) patch.custom_label = custom_label || null;

    let query = supabase.from('congregation_roles').update(patch).eq('role_key', role_key);
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);

    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update role';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
