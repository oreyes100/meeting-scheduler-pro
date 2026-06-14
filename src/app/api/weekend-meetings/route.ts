import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('weekend_meetings')
      .select(`
        *,
        outline:public_talk_outlines(*),
        local_speaker:persons!weekend_meetings_local_speaker_id_fkey(id, first_name, last_name, display_name),
        visiting_speaker:public_speakers!weekend_meetings_visiting_speaker_id_fkey(*),
        chairman:persons!weekend_meetings_chairman_id_fkey(id, first_name, last_name),
        wt_conductor:persons!weekend_meetings_wt_conductor_id_fkey(id, first_name, last_name),
        wt_reader:persons!weekend_meetings_wt_reader_id_fkey(id, first_name, last_name),
        hospitality_person:persons!weekend_meetings_hospitality_person_id_fkey(id, first_name, last_name)
      `)
      .order('date', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ meetings: data || [] });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { date } = body;
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    const { data, error } = await supabase
      .from('weekend_meetings')
      .insert({ date, speaker_type: 'local' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ meeting: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
