import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();

    // 1. Update the meeting table
    const { error: meetingError } = await supabase
      .from('meetings')
      .update({
        song_opening: body.song_opening,
        song_middle: body.song_middle,
        song_closing: body.song_closing,
        chairman_id: body.chairman_id || null,
        opening_prayer_id: body.opening_prayer_id || null,
        closing_prayer_id: body.closing_prayer_id || null,
        cbs_conductor_id: body.cbs_conductor_id || null,
        cbs_reader_id: body.cbs_reader_id || null,
      })
      .eq('id', id);

    if (meetingError) throw meetingError;

    // 2. Update meeting parts
    if (body.parts && Array.isArray(body.parts)) {
      for (const part of body.parts) {
        const { error: partError } = await supabase
          .from('meeting_parts')
          .update({
            assigned_user_id: part.assigned_user_id || null,
            student_id: part.student_id || null,
            title: part.title,
            duration_minutes: part.duration_minutes,
            assistant_user_id: part.assistant_user_id || null,
            student_part_type: part.student_part_type || null,
          })
          .eq('id', part.id);
        
        if (partError) {
          console.error(`Error updating part ${part.id}:`, partError);
          // We can decide whether to throw or continue. We'll throw to ensure data integrity
          throw partError;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save meeting data';
    console.error(`PUT /api/meetings/[id]/save error:`, error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
