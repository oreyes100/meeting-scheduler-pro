import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const EDITABLE = ['number', 'name', 'color', 'coordinates', 'group_name', 'assigned_to', 'visit_start', 'visit_end', 'note', 'status'] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const update: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (k in body) update[k] = body[k];
    }

    const { data, error } = await supabase.from('territories').update(update).eq('id', id).select().single();
    if (error) throw error;

    return NextResponse.json({ territory: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update territory';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase.from('territories').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete territory';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
