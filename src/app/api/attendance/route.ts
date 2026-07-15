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
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabase.from('meeting_attendance').select('*').order('meeting_date', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);
    if (from) query = query.gte('meeting_date', from);
    if (to) query = query.lte('meeting_date', to);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ rows: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch attendance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const payload = {
      meeting_date: body.meeting_date,
      meeting_type: body.meeting_type,
      in_person: body.in_person === '' || body.in_person == null ? null : Number(body.in_person),
      online: body.online === '' || body.online == null ? null : Number(body.online),
      updated_at: new Date().toISOString(),
      congregation_id: ctx.congreId ?? null,
    };
    const { data, error } = await supabase
      .from('meeting_attendance')
      .upsert(payload, { onConflict: 'meeting_date,meeting_type,congregation_id' })
      .select().single();
    if (error) throw error;
    return NextResponse.json({ row: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save attendance';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
