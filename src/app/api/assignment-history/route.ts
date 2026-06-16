import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all meeting parts with their meeting dates, ordered by date desc
    const { data: parts, error: partsErr } = await supabase
      .from('meeting_parts')
      .select('assigned_user_id, assistant_user_id, part_type, student_part_type, title, role, meeting_id')
      .not('assigned_user_id', 'is', null);

    if (partsErr) throw partsErr;

    const { data: meetings, error: meetErr } = await supabase
      .from('meetings')
      .select('id, date')
      .order('date', { ascending: false });

    if (meetErr) throw meetErr;

    const dateById: Record<string, string> = {};
    for (const m of meetings || []) dateById[m.id] = m.date;

    // Build: { [userId]: { [role]: { date, title } } } — keep only the most recent per role
    const history: Record<string, Record<string, { date: string; title: string }>> = {};

    // Also track chairman, prayers, cbs from meetings table
    const { data: meetingRoles, error: mrErr } = await supabase
      .from('meetings')
      .select('date, chairman_id, opening_prayer_id, closing_prayer_id, cbs_conductor_id, cbs_reader_id')
      .order('date', { ascending: false });

    if (!mrErr && meetingRoles) {
      for (const m of meetingRoles) {
        const entries: [string | null, string][] = [
          [m.chairman_id, 'chairman'],
          [m.opening_prayer_id, 'opening_prayer'],
          [m.closing_prayer_id, 'closing_prayer'],
          [m.cbs_conductor_id, 'cbs_conductor'],
          [m.cbs_reader_id, 'cbs_reader'],
        ];
        for (const [uid, role] of entries) {
          if (!uid) continue;
          if (!history[uid]) history[uid] = {};
          if (!history[uid][role]) {
            history[uid][role] = { date: m.date, title: '' };
          }
        }
      }
    }

    // Process parts — sorted by date desc
    const sortedParts = (parts || [])
      .map(p => ({ ...p, date: dateById[p.meeting_id] || '' }))
      .filter(p => p.date)
      .sort((a, b) => b.date.localeCompare(a.date));

    for (const p of sortedParts) {
      const uid = p.assigned_user_id;
      if (!uid) continue;
      if (!history[uid]) history[uid] = {};

      // Determine the role key
      let roleKey = p.part_type || p.role || 'unknown';
      if (p.part_type === 'student_part' && p.student_part_type) {
        roleKey = `student_${p.student_part_type}`;
      }

      if (!history[uid][roleKey]) {
        history[uid][roleKey] = { date: p.date, title: p.title || '' };
      }

      // Also track assistant history
      if (p.assistant_user_id) {
        if (!history[p.assistant_user_id]) history[p.assistant_user_id] = {};
        if (!history[p.assistant_user_id]['assistant']) {
          history[p.assistant_user_id]['assistant'] = { date: p.date, title: p.title || '' };
        }
      }
    }

    return NextResponse.json({ history });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch assignment history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
