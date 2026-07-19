import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProgram, type ProgramPart } from '@/lib/programs';
import { getSessionContext } from '@/lib/serverContext';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const SCHEMA_ERROR_CODES = new Set(['PGRST200', '42703', 'PGRST204']);
function isSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    (error.code !== undefined && SCHEMA_ERROR_CODES.has(error.code)) ||
    (typeof error.message === 'string' && (error.message.includes('relationship') || error.message.includes('column') || error.message.includes('does not exist')))
  );
}

export async function GET() {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);

    let meetingsData: any[] = [];
    let migrationApplied = true;

    let fullQuery = supabase
      .from('meetings')
      .select(`id, title, date, duration_minutes, created_by, song_opening, song_middle, song_closing, chairman_id, opening_prayer_id, closing_prayer_id, cbs_conductor_id, cbs_reader_id, is_published, cleaning_group, assembly_type`)
      .order('date', { ascending: true });
    if (ctx.congreId) fullQuery = fullQuery.eq('congregation_id', ctx.congreId);

    const { data: fullData, error: fullError } = await fullQuery;

    if (fullError) {
      if (isSchemaMissing(fullError)) {
        migrationApplied = false;
        let baseQuery = supabase.from('meetings').select('id, title, date, duration_minutes, created_by').order('date', { ascending: true });
        if (ctx.congreId) baseQuery = baseQuery.eq('congregation_id', ctx.congreId);
        const { data: baseData, error: baseError } = await baseQuery;
        if (baseError) throw baseError;
        meetingsData = baseData || [];
      } else {
        throw fullError;
      }
    } else {
      meetingsData = fullData || [];
    }

    const usersById: Record<string, { id: string; name: string }> = {};
    if (!migrationApplied) {
      const { data: usersData } = await supabase.from('users').select('id, name');
      for (const u of usersData || []) usersById[u.id] = u;
    }

    const { data: fullParts, error: partsError } = await supabase
      .from('meeting_parts')
      .select(`id, meeting_id, role, assigned_user_id, class_type, part_type, part_number, title, duration_minutes, assistant_user_id, study_point, student_part_type, users:assigned_user_id ( id, name ), assistant:assistant_user_id ( id, name )`);

    let partsData: any[] = [];
    if (partsError) {
      if (isSchemaMissing(partsError)) {
        const { data: baseParts, error: basePartsError } = await supabase.from('meeting_parts').select('id, meeting_id, role, assigned_user_id');
        if (basePartsError) throw basePartsError;
        partsData = (baseParts || []).map((p: any) => ({ ...p, users: p.assigned_user_id ? (usersById[p.assigned_user_id] ?? null) : null, assistant: null }));
      } else {
        throw partsError;
      }
    } else {
      partsData = fullParts || [];
    }

    const meetings = meetingsData.map((meeting: any) => {
      const parts = partsData
        .filter((p: any) => p.meeting_id === meeting.id)
        .map((p: any) => ({ ...p, users: Array.isArray(p.users) ? p.users[0] ?? null : p.users, assistant: Array.isArray(p.assistant) ? p.assistant[0] ?? null : p.assistant }))
        .sort((a: any, b: any) => (a.part_number || 0) - (b.part_number || 0));
      return {
        ...meeting, parts,
        chairman: Array.isArray(meeting.chairman) ? meeting.chairman[0] ?? null : (meeting.chairman ?? null),
        _migration_applied: migrationApplied,
      };
    });

    return NextResponse.json({ meetings, migration_applied: migrationApplied });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch meetings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { title, date, duration_minutes } = body;
    const program = getProgram(date);

    const { data: meeting, error: mError } = await supabase
      .from('meetings')
      .insert({ title: title || 'Life and Ministry Meeting', date, duration_minutes: duration_minutes || 105, song_opening: program.songOpening, song_middle: program.songMiddle, song_closing: program.songClosing, is_published: false, congregation_id: ctx.congreId ?? null })
      .select().single();
    if (mError) {
      // Duplicate (unique constraint on date+congregation_id) — return existing meeting
      if ((mError as any).code === '23505') {
        let existingQuery = supabase.from('meetings').select('id, title, date, duration_minutes').eq('date', date);
        if (ctx.congreId) existingQuery = existingQuery.eq('congregation_id', ctx.congreId);
        const { data: existing } = await existingQuery.single();
        if (existing) return NextResponse.json({ success: true, meeting: existing, partsCreated: 0, existed: true });
      }
      throw mError;
    }

    const defaultParts = program.parts.map((p: ProgramPart) => ({
      meeting_id: meeting.id,
      class_type: 'main',
      part_type: p.type,
      part_number: p.number,
      title: p.title,
      duration_minutes: p.duration,
      role: p.role,
      student_part_type: p.student_part_type || null,
    }));

    const { error: pError } = await supabase.from('meeting_parts').insert(defaultParts);
    if (pError) throw pError;

    return NextResponse.json({ success: true, meeting, partsCreated: defaultParts.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create meeting';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
