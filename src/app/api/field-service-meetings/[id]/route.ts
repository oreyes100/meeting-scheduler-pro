import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = await params;
    const body = await request.json();

    const { error } = await supabase
      .from('field_service_meetings')
      .update({
        day_of_week: body.day_of_week,
        time_period: body.time_period,
        meeting_time: body.meeting_time,
        location: body.location,
        conductor_id: body.conductor_id || null,
        zoom_host_id: body.zoom_host_id || null,
        territory: body.territory,
        notes: body.notes,
        group_id: body.group_id || null,
        cart_count: body.cart_count || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update meeting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = await params;

    const { error } = await supabase.from('field_service_meetings').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete meeting';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
