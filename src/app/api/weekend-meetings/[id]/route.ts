import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const ALLOWED = [
  'speaker_type', 'local_speaker_id', 'visiting_speaker_id', 'other_speaker_name',
  'outline_id', 'special_talk_title', 'song', 'speaker_confirmed', 'notes',
  'chairman_id', 'wt_conductor_id', 'wt_reader_id',
  'hospitality_person_id', 'hospitality_text',
];

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ALLOWED) {
      if (k in body) updates[k] = body[k];
    }

    // Record outline history when outline assigned
    if (updates.outline_id) {
      const { data: wm } = await supabase
        .from('weekend_meetings')
        .select('date, outline_id')
        .eq('id', id)
        .single();

      if (wm && wm.outline_id !== updates.outline_id) {
        // Get speaker name for history
        let speakerName: string | null = null;
        const speakerType = updates.speaker_type || body.speaker_type;
        if (speakerType === 'visiting' && updates.visiting_speaker_id) {
          const { data: sp } = await supabase.from('public_speakers').select('name').eq('id', updates.visiting_speaker_id).single();
          speakerName = sp?.name ?? null;
        } else if (speakerType === 'local' && updates.local_speaker_id) {
          const { data: p } = await supabase.from('users').select('first_name, last_name, display_name, name').eq('id', updates.local_speaker_id).single();
          speakerName = p ? (p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.name || '').trim() : null;
        }

        await supabase.from('public_talk_history').insert({
          outline_id: updates.outline_id,
          date: wm.date,
          speaker_name: speakerName,
        });
      }
    }

    const { data, error } = await supabase
      .from('weekend_meetings')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        outline:public_talk_outlines(*),
        local_speaker:users!weekend_meetings_local_speaker_id_fkey(id, first_name, last_name, display_name, name),
        visiting_speaker:public_speakers!weekend_meetings_visiting_speaker_id_fkey(*),
        chairman:users!weekend_meetings_chairman_id_fkey(id, first_name, last_name, display_name, name),
        wt_conductor:users!weekend_meetings_wt_conductor_id_fkey(id, first_name, last_name, display_name, name),
        wt_reader:users!weekend_meetings_wt_reader_id_fkey(id, first_name, last_name, display_name, name),
        hospitality_person:users!weekend_meetings_hospitality_person_id_fkey(id, first_name, last_name, display_name, name)
      `)
      .single();

    if (error) throw error;
    return NextResponse.json({ meeting: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('weekend_meetings').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
