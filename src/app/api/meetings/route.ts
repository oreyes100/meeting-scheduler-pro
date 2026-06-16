import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProgram, type ProgramPart } from '@/lib/programs';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Error codes that indicate the schema migration hasn't run yet
const SCHEMA_ERROR_CODES = new Set([
  'PGRST200', // relationship not found
  '42703',    // column does not exist
  'PGRST204', // could not find foreign key
]);

function isSchemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    (error.code && SCHEMA_ERROR_CODES.has(error.code)) ||
    (typeof error.message === 'string' && (
      error.message.includes('relationship') ||
      error.message.includes('column') ||
      error.message.includes('does not exist')
    ))
  );
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── 1. Fetch meetings ──────────────────────────────────────────────────────
    // Try the full query with FK-based joins first.
    // If the migration hasn't run yet (PGRST200 / 42703), fall back to plain *.
    let meetingsData: any[] = [];
    let migrationApplied = true;

    const { data: fullData, error: fullError } = await supabase
      .from('meetings')
      .select(`
        id, title, date, duration_minutes, created_by,
        song_opening, song_middle, song_closing,
        chairman_id, opening_prayer_id, closing_prayer_id,
        cbs_conductor_id, cbs_reader_id, is_published, cleaning_group
      `)
      .order('date', { ascending: true });

    if (fullError) {
      if (isSchemaMissing(fullError)) {
        // Migration not applied yet — fall back to base columns only
        console.warn('⚠️  meetings migration not applied, falling back to base query');
        migrationApplied = false;

        const { data: baseData, error: baseError } = await supabase
          .from('meetings')
          .select('id, title, date, duration_minutes, created_by')
          .order('date', { ascending: true });

        if (baseError) throw baseError;
        meetingsData = baseData || [];
      } else {
        throw fullError;
      }
    } else {
      meetingsData = fullData || [];
    }

    // ── 2. Fetch all users for manual look-up (needed in fallback mode) ────────
    const usersById: Record<string, { id: string; name: string }> = {};
    if (!migrationApplied) {
      const { data: usersData } = await supabase.from('users').select('id, name');
      for (const u of usersData || []) usersById[u.id] = u;
    }

    // ── 3. Fetch meeting parts ─────────────────────────────────────────────────
    let partsData: any[] = [];

    const { data: fullParts, error: partsError } = await supabase
      .from('meeting_parts')
      .select(`
        id, meeting_id, role, assigned_user_id,
        class_type, part_type, part_number, title, duration_minutes,
        assistant_user_id, study_point, student_part_type,
        users:assigned_user_id ( id, name ),
        assistant:assistant_user_id ( id, name )
      `);

    if (partsError) {
      if (isSchemaMissing(partsError)) {
        console.warn('⚠️  meeting_parts migration not applied, falling back to base query');

        const { data: baseParts, error: basePartsError } = await supabase
          .from('meeting_parts')
          .select('id, meeting_id, role, assigned_user_id');

        if (basePartsError) throw basePartsError;

        // Manually attach user objects from our usersById map
        partsData = (baseParts || []).map((p: any) => ({
          ...p,
          users: p.assigned_user_id ? (usersById[p.assigned_user_id] ?? null) : null,
          assistant: null,
        }));
      } else {
        throw partsError;
      }
    } else {
      partsData = fullParts || [];
    }

    // ── 4. Build response: attach parts to each meeting ───────────────────────
    const meetings = meetingsData.map((meeting: any) => {
      const parts = partsData
        .filter((p: any) => p.meeting_id === meeting.id)
        .map((p: any) => ({
          ...p,
          users: Array.isArray(p.users) ? p.users[0] ?? null : p.users,
          assistant: Array.isArray(p.assistant) ? p.assistant[0] ?? null : p.assistant,
        }))
        .sort((a: any, b: any) => (a.part_number || 0) - (b.part_number || 0));

      return {
        ...meeting,
        parts,
        // Normalise FK-joined objects (Supabase may return arrays for some joins)
        chairman: Array.isArray(meeting.chairman) ? meeting.chairman[0] ?? null : (meeting.chairman ?? null),
        opening_prayer: Array.isArray(meeting.opening_prayer) ? meeting.opening_prayer[0] ?? null : (meeting.opening_prayer ?? null),
        closing_prayer: Array.isArray(meeting.closing_prayer) ? meeting.closing_prayer[0] ?? null : (meeting.closing_prayer ?? null),
        cbs_conducer: Array.isArray(meeting.cbs_conducer) ? meeting.cbs_conducer[0] ?? null : (meeting.cbs_conducer ?? null),
        cbs_reader: Array.isArray(meeting.cbs_reader) ? meeting.cbs_reader[0] ?? null : (meeting.cbs_reader ?? null),
        // Signal to the client whether the full schema is available
        _migration_applied: migrationApplied,
      };
    });

    return NextResponse.json({ meetings, migration_applied: migrationApplied });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch meetings';
    console.error('GET /api/meetings error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { title, date, duration_minutes } = body;

    // Resolve the JW program for the meeting week
    const program = getProgram(date);

    const { data: meeting, error: mError } = await supabase
      .from('meetings')
      .insert({
        title: title || 'Life and Ministry Meeting',
        date,
        duration_minutes: duration_minutes || 105,
        song_opening: program.songOpening,
        song_middle: program.songMiddle,
        song_closing: program.songClosing,
        is_published: false
      })
      .select()
      .single();

    if (mError) throw mError;

    // Build the 9 parts from the program
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

    const { error: pError } = await supabase
      .from('meeting_parts')
      .insert(defaultParts);

    if (pError) throw pError;

    return NextResponse.json({ success: true, meeting, partsCreated: defaultParts.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create meeting';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
