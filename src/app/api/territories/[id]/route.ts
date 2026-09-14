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

    // Snapshot before update to detect a fresh assignment.
    const { data: before } = await supabase
      .from('territories')
      .select('assigned_to, visit_start')
      .eq('id', id)
      .maybeSingle();

    const update: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (k in body) update[k] = body[k];
    }

    let query = supabase.from('territories').update(update).eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query.select().single();
    if (error) throw error;

    // Best-effort: notify the publisher on a fresh assignment (never aborts the update).
    try {
      const prev = (before as { assigned_to?: string | null; visit_start?: string | null } | null) ?? null;
      const newAssignedTo = 'assigned_to' in body ? (body.assigned_to ?? null) : (prev?.assigned_to ?? null);
      if (newAssignedTo && newAssignedTo !== (prev?.assigned_to ?? null) && ctx.congreId) {
        const { getMessagingSettings, notify, renderTemplate, DEFAULT_TEMPLATES } = await import('@/lib/messaging');
        const { data: u } = await supabase.from('users').select('name').eq('id', newAssignedTo).maybeSingle();
        const assignedName = (u as { name?: string } | null)?.name ?? String(newAssignedTo);
        const t = data as { number?: number | null; name?: string } | null;
        const label = `${t?.number != null ? t.number + '. ' : ''}${t?.name ?? ''}`.trim() || 'el territorio';
        const s = await getMessagingSettings(ctx.congreId);
        if (s.notify_on_assign) {
          const visitStart = ('visit_start' in body ? body.visit_start : prev?.visit_start) ?? new Date().toISOString().slice(0, 10);
          await notify({
            userId: newAssignedTo,
            congregationId: ctx.congreId,
            kind: 'territory_assigned',
            title: `Se te asignó el territorio ${label}`,
            body: renderTemplate(s.template_assign || DEFAULT_TEMPLATES.assign, {
              nombre: assignedName, territorio: label, fecha: String(visitStart), dias: '0', parejas: '',
            }),
            territoryId: id,
            imageData: typeof body.image_data === 'string' ? body.image_data : null,
          });
        }
      }
    } catch { /* best-effort */ }

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
