import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: outlines, error } = await supabase
      .from('public_talk_outlines')
      .select('*')
      .order('number', { ascending: true });

    if (error) throw error;

    // Attach last_given info from public_talk_history
    const { data: history } = await supabase
      .from('public_talk_history')
      .select('outline_id, date, speaker_name')
      .order('date', { ascending: false });

    const lastGiven: Record<string, { date: string; speaker: string | null }> = {};
    for (const h of history || []) {
      if (!lastGiven[h.outline_id]) {
        lastGiven[h.outline_id] = { date: h.date, speaker: h.speaker_name };
      }
    }

    const enriched = (outlines || []).map(o => ({
      ...o,
      last_given_date: lastGiven[o.id]?.date ?? null,
      last_given_speaker: lastGiven[o.id]?.speaker ?? null,
    }));

    return NextResponse.json({ outlines: enriched });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { number, title } = body;

    if (!number || !title) {
      return NextResponse.json({ error: 'number and title required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('public_talk_outlines')
      .insert({ number: Number(number), title: String(title).trim() })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ outline: data }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
