import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';

const EDITABLE = ['number', 'name', 'color', 'coordinates', 'group_name', 'assigned_to', 'visit_start', 'visit_end', 'note', 'status'] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    const { id } = await params;
    const supabase = sb();
    const body = await request.json();

    const update: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (k in body) update[k] = body[k];
    }

    let query = supabase.from('territories').update(update).eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query.select().single();
    if (error) throw error;

    return NextResponse.json({ territory: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update territory';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    const { id } = await params;
    const supabase = sb();

    let query = supabase.from('territories').delete().eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);
    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete territory';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
