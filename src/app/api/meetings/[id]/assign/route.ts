import { NextRequest, NextResponse } from 'next/server';
import { runAutoAssignment } from '@/services/auto-assign-service.js';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    // Debug: Check environment variables
    console.log('🔍 DEBUG: Checking environment variables');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL || 'NOT SET');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'NOT SET');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET (length: ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length + ')' : 'NOT SET');

    console.log(`🤖 Triggering auto-assignment for meeting: ${meetingId}`);
    const result = await runAutoAssignment(meetingId);

    return NextResponse.json({
      success: true,
      message: 'Auto-assignment completed successfully',
      ...result
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('❌ Error during auto-assignment API route:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}