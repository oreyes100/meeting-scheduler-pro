import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const ALLOWED = [
  'name', 'number', 'congregation_id', 'language', 'time_zone',
  'weekend_meeting_day', 'weekend_meeting_time', 'midweek_meeting_day', 'midweek_meeting_time',
  'zoom_meeting_id', 'zoom_password', 'zoom_link', 'dial_in_number',
  'kingdom_hall_address', 'circuit', 'co_name', 'co_contact_details', 'auxiliary_rooms',
];

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('congregation_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ congregation: data || null });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
      : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of ALLOWED) if (k in body) updates[k] = body[k];

    // Find existing row
    const { data: existing } = await supabase
      .from('congregation_settings')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('congregation_settings')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ congregation: data });
    }

    const { data, error } = await supabase
      .from('congregation_settings')
      .insert(updates)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ congregation: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message
      : (e && typeof e === 'object' && 'message' in e) ? String((e as { message: unknown }).message)
      : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
