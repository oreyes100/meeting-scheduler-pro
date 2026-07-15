import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionContext } from '@/lib/serverContext';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('weekend_meetings')
      .select(`*, outline:public_talk_outlines(*), local_speaker:users!weekend_meetings_local_speaker_id_fkey(id, first_name, last_name, display_name, name), visiting_speaker:public_speakers!weekend_meetings_visiting_speaker_id_fkey(*), chairman:users!weekend_meetings_chairman_id_fkey(id, first_name, last_name, display_name, name), wt_conductor:users!weekend_meetings_wt_conductor_id_fkey(id, first_name, last_name, display_name, name), wt_reader:users!weekend_meetings_wt_reader_id_fkey(id, first_name, last_name, display_name, name), hospitality_person:users!weekend_meetings_hospitality_person_id_fkey(id, first_name, last_name, display_name, name)`)
      .order('date', { ascending: true });
    if (ctx.congreId) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ meetings: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { date } = body;
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    const { data, error } = await supabase
      .from('weekend_meetings')
      .insert({ date, speaker_type: 'local', congregation_id: ctx.congreId ?? null })
      .select().single();

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate')) {
        let q = supabase.from('weekend_meetings').select().eq('date', date);
        if (ctx.congreId) q = q.eq('congregation_id', ctx.congreId);
        const { data: existing } = await q.single();
        if (existing) return NextResponse.json({ meeting: existing }, { status: 200 });
      }
      throw error;
    }
    return NextResponse.json({ meeting: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
