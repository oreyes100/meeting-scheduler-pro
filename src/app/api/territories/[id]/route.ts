import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { randomUUID } from 'crypto';

const EDITABLE = ['number', 'name', 'color', 'coordinates', 'group_name', 'assigned_to', 'visit_start', 'visit_end', 'note', 'status'] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
    const { id } = await params;
    const supabase = sb();
    const body = await request.json();

    // Snapshot before update to detect assignment changes
    const db = getDb();
    const before = db.prepare(`SELECT assigned_to, visit_start, visit_end FROM territories WHERE id = ?`).get(id) as
      { assigned_to: string | null; visit_start: string | null; visit_end: string | null } | undefined;

    const update: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (k in body) update[k] = body[k];
    }

    let query = supabase.from('territories').update(update).eq('id', id);
    if (ctx.congreId && !ctx.isSuperAdmin) query = query.eq('congregation_id', ctx.congreId);

    const { data, error } = await query.select().single();
    if (error) throw error;

    // Auto-manage assignment history
    if (before) {
      const newAssignedTo: string | null = 'assigned_to' in body ? (body.assigned_to ?? null) : before.assigned_to;
      const newVisitEnd: string | null = 'visit_end' in body ? (body.visit_end ?? null) : before.visit_end;

      // Newly assigned (was null, now has a value)
      if (!before.assigned_to && newAssignedTo) {
        const user = db.prepare(`SELECT name FROM users WHERE id = ?`).get(newAssignedTo) as { name: string } | undefined;
        const assignedName = user?.name ?? newAssignedTo;
        const assignedDate: string | null = 'visit_start' in body ? (body.visit_start ?? null) : before.visit_start;
        db.prepare(`
          INSERT INTO territory_assignments (id, territory_id, assigned_name, assigned_date, congregation_id)
          VALUES (?, ?, ?, ?, ?)
        `).run(randomUUID(), id, assignedName, assignedDate, ctx.congreId ?? null);
      }

      // Completed (visit_end newly set)
      if (!before.visit_end && newVisitEnd) {
        // Update the latest open assignment record for this territory
        const openAssignment = db.prepare(`
          SELECT id FROM territory_assignments
          WHERE territory_id = ? AND completed_date IS NULL
          ORDER BY created_at DESC LIMIT 1
        `).get(id) as { id: string } | undefined;
        if (openAssignment) {
          db.prepare(`UPDATE territory_assignments SET completed_date = ? WHERE id = ?`)
            .run(newVisitEnd, openAssignment.id);
        }
      }
    }

    return NextResponse.json({ territory: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update territory';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return unauthenticated();
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
