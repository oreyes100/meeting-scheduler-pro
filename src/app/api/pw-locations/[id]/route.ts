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
      .from('pw_locations')
      .update({
        cart_number: body.cart_number,
        name: body.name,
        address: body.address,
        map_link: body.map_link,
        notes: body.notes,
        sort_order: body.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    if (body.shifts) {
      await supabase.from('pw_shifts').delete().eq('location_id', id);
      if (body.shifts.length > 0) {
        const rows = body.shifts.map((s: any, i: number) => ({
          location_id: id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          persons_needed: s.persons_needed || 2,
          sort_order: i,
        }));
        const { error: sErr } = await supabase.from('pw_shifts').insert(rows);
        if (sErr) throw sErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update location';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = await params;
    const { error } = await supabase.from('pw_locations').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete location';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
