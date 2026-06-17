import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: groups, error } = await supabase
      .from('field_service_groups')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const { data: members, error: mErr } = await supabase
      .from('field_service_group_members')
      .select(`
        id, group_id, user_id, role, sort_order,
        user:users!field_service_group_members_user_id_fkey(id, first_name, last_name, display_name, name, gender,
          is_elder, is_ministerial_servant, is_regular_pioneer, is_auxiliary_pioneer,
          is_special_pioneer, is_publisher, is_unbaptized_publisher)
      `)
      .order('sort_order', { ascending: true });

    if (mErr) throw mErr;

    const membersByGroup: Record<string, any[]> = {};
    for (const m of members || []) {
      const gid = m.group_id;
      if (!membersByGroup[gid]) membersByGroup[gid] = [];
      const u = Array.isArray(m.user) ? m.user[0] : m.user;
      membersByGroup[gid].push({ ...m, user: u });
    }

    const result = (groups || []).map(g => ({
      ...g,
      members: membersByGroup[g.id] || [],
    }));

    return NextResponse.json({ groups: result });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch groups';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const { data, error } = await supabase
      .from('field_service_groups')
      .insert({
        name: body.name || 'New Group',
        meeting_day: body.meeting_day || null,
        meeting_time: body.meeting_time || null,
        meeting_location: body.meeting_location || null,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ group: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create group';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
