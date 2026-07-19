import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getSessionContext } from '@/lib/serverContext';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = sb();
    const today = new Date().toISOString().slice(0, 10);
    const filter = ctx.congreId && !ctx.isSuperAdmin;

    // 1. Future meeting ids for this congregation
    let meetingsQuery = supabase
      .from('meetings')
      .select('id, date')
      .gte('date', today)
      .order('date', { ascending: true });
    if (filter) meetingsQuery = meetingsQuery.eq('congregation_id', ctx.congreId!);
    const { data: meetings, error: mErr } = await meetingsQuery;
    if (mErr) throw mErr;

    const dateById: Record<string, string> = {};
    for (const m of meetings || []) dateById[m.id] = m.date;
    const meetingIds = Object.keys(dateById);

    const assignments: { date: string; role: string; title: string | null }[] = [];

    // 2. Parts where user is assigned / assistant / student
    if (meetingIds.length > 0) {
      const { data: parts, error: pErr } = await supabase
        .from('meeting_parts')
        .select('meeting_id, part_type, student_part_type, title, assigned_user_id, assistant_user_id, student_id')
        .in('meeting_id', meetingIds);
      if (pErr) throw pErr;

      for (const p of parts || []) {
        const date = dateById[p.meeting_id];
        if (!date) continue;
        if (p.assigned_user_id === ctx.userId || p.student_id === ctx.userId) {
          let role = p.part_type as string;
          if (p.part_type === 'student_part' && p.student_part_type) role = `student_${p.student_part_type}`;
          assignments.push({ date, role, title: p.title ?? null });
        }
        if (p.assistant_user_id === ctx.userId) {
          assignments.push({ date, role: 'assistant', title: p.title ?? null });
        }
      }
    }

    // 3. Meeting-level roles (chairman, prayers, CBS)
    let rolesQuery = supabase
      .from('meetings')
      .select('date, chairman_id, opening_prayer_id, closing_prayer_id, cbs_conductor_id, cbs_reader_id')
      .gte('date', today)
      .order('date', { ascending: true });
    if (filter) rolesQuery = rolesQuery.eq('congregation_id', ctx.congreId!);
    const { data: mtgs } = await rolesQuery;

    for (const m of mtgs || []) {
      const roles: [string | null, string][] = [
        [m.chairman_id, 'chairman'],
        [m.opening_prayer_id, 'opening_prayer'],
        [m.closing_prayer_id, 'closing_prayer'],
        [m.cbs_conductor_id, 'cbs_conductor'],
        [m.cbs_reader_id, 'cbs_reader'],
      ];
      for (const [uid, role] of roles) {
        if (uid === ctx.userId) assignments.push({ date: m.date, role, title: null });
      }
    }

    assignments.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ assignments });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch assignments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
