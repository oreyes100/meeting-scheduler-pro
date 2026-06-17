import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = await params;
    const body = await request.json();

    // Update group details
    if (body.group) {
      const { error } = await supabase
        .from('field_service_groups')
        .update({
          name: body.group.name,
          meeting_day: body.group.meeting_day,
          meeting_time: body.group.meeting_time,
          meeting_location: body.group.meeting_location,
          sort_order: body.group.sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    }

    // Sync members
    if (body.members) {
      // Delete existing members
      await supabase.from('field_service_group_members').delete().eq('group_id', id);

      // Insert new members
      if (body.members.length > 0) {
        const rows = body.members.map((m: any, i: number) => ({
          group_id: id,
          user_id: m.user_id,
          role: m.role || 'member',
          sort_order: i,
        }));
        const { error: mErr } = await supabase.from('field_service_group_members').insert(rows);
        if (mErr) throw mErr;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update group';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id } = await params;

    const { error } = await supabase.from('field_service_groups').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete group';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
