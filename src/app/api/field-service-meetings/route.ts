import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionContext } from '@/lib/serverContext';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(request: Request) {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const weekDate = searchParams.get('week');

    let query = supabase
      .from('field_service_meetings')
      .select(`*, conductor:users!field_service_meetings_conductor_id_fkey(id, first_name, last_name, name), zoom_host:users!field_service_meetings_zoom_host_id_fkey(id, first_name, last_name, name), group:field_service_groups!field_service_meetings_group_id_fkey(id, name)`)
      .order('meeting_time', { ascending: true });

    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
    if (weekDate) query = query.eq('week_date', weekDate);

    const { data, error } = await query;
    if (error) throw error;

    const meetings = (data || []).map((m: any) => ({
      ...m,
      conductor: Array.isArray(m.conductor) ? m.conductor[0] : m.conductor,
      zoom_host: Array.isArray(m.zoom_host) ? m.zoom_host[0] : m.zoom_host,
      group: Array.isArray(m.group) ? m.group[0] : m.group,
    }));

    return NextResponse.json({ meetings });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch field service meetings';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const { data, error } = await supabase
      .from('field_service_meetings')
      .insert({ week_date: body.week_date, day_of_week: body.day_of_week, time_period: body.time_period || 'am', meeting_time: body.meeting_time || null, location: body.location || null, conductor_id: body.conductor_id || null, zoom_host_id: body.zoom_host_id || null, territory: body.territory || null, notes: body.notes || null, group_id: body.group_id || null, cart_count: body.cart_count || 0, congregation_id: ctx.congreId ?? null })
      .select().single();

    if (error) throw error;
    return NextResponse.json({ meeting: data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create meeting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
