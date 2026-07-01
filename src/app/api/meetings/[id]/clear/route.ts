import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Clear meeting level assignments
    const { error: mError } = await supabase
      .from('meetings')
      .update({
        chairman_id: null,
        opening_prayer_id: null,
        closing_prayer_id: null,
        cbs_conductor_id: null,
        cbs_reader_id: null,
      })
      .eq('id', meetingId);

    if (mError) throw mError;

    // 2. Clear parts assignments
    const { error: pError } = await supabase
      .from('meeting_parts')
      .update({
        assigned_user_id: null,
        assistant_user_id: null,
      })
      .eq('meeting_id', meetingId);

    if (pError) throw pError;

    // 3. Clear part_history rows
    await supabase
      .from('part_history')
      .delete()
      .eq('meeting_id', meetingId);

    return NextResponse.json({
      success: true,
      message: 'All assignments cleared successfully'
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear assignments';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
