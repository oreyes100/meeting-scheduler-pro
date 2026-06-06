import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProgram, type ProgramPart } from '@/lib/programs';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Rebuild meeting_parts from the JW program for the meeting's week.
// Optionally preserves existing assignments (assigned_user_id, assistant_user_id) by part_number.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json().catch(() => ({}));
    const preserveAssignments = body?.preserveAssignments !== false; // default true

    // Fetch the meeting
    const { data: meeting, error: mError } = await supabase
      .from('meetings')
      .select('id, date')
      .eq('id', id)
      .single();
    if (mError) throw mError;
    if (!meeting) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });

    // Resolve the JW program for the meeting's week
    const program = getProgram(meeting.date);

    // Optionally capture existing assignments by part_number
    const existingByPartNumber: Record<number, { assigned_user_id?: string | null; assistant_user_id?: string | null }> = {};
    if (preserveAssignments) {
      const { data: existingParts } = await supabase
        .from('meeting_parts')
        .select('part_number, assigned_user_id, assistant_user_id')
        .eq('meeting_id', id);
      for (const p of existingParts || []) {
        if (p.part_number != null) {
          existingByPartNumber[p.part_number] = {
            assigned_user_id: p.assigned_user_id,
            assistant_user_id: p.assistant_user_id,
          };
        }
      }
    }

    // Delete existing parts
    const { error: dError } = await supabase
      .from('meeting_parts')
      .delete()
      .eq('meeting_id', id);
    if (dError) throw dError;

    // Insert new parts from the program, carrying over assignments by part_number
    const newParts = program.parts.map((p: ProgramPart) => {
      const carry = existingByPartNumber[p.number] || {};
      return {
        meeting_id: id,
        class_type: 'main',
        part_type: p.type,
        part_number: p.number,
        title: p.title,
        duration_minutes: p.duration,
        role: p.role,
        student_part_type: p.student_part_type || null,
        assigned_user_id: carry.assigned_user_id || null,
        assistant_user_id: carry.assistant_user_id || null,
      };
    });

    const { error: iError } = await supabase
      .from('meeting_parts')
      .insert(newParts);
    if (iError) throw iError;

    // Also update the songs on the meeting from the program
    await supabase
      .from('meetings')
      .update({
        song_opening: program.songOpening,
        song_middle: program.songMiddle,
        song_closing: program.songClosing,
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      weekLabel: program.weekLabel,
      partsCreated: newParts.length,
      assignmentsPreserved: preserveAssignments,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to rebuild parts';
    console.error('rebuild-parts error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
