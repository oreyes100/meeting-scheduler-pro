import { supabase } from './meetings/backend/autoAssign.js';

async function main() {
  try {
    console.log('🔍 Checking for test user...');
    // 1. Get or create test user
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'test@example.com')
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    let userId;
    if (existingUser) {
      userId = existingUser.id;
      console.log('👤 Existing test user found:', userId);
    } else {
      console.log('👤 Creating new test user...');
      const { data: newUser, error: insertUserError } = await supabase
        .from('users')
        .insert([{ name: 'Prueba', email: 'test@example.com' }])
        .select()
        .single();

      if (insertUserError) throw insertUserError;
      userId = newUser.id;
      console.log('👤 Created test user:', userId);
    }

    // 2. Create the meeting
    console.log('📅 Creating test meeting...');
    const { data: meeting, error: insertMeetingError } = await supabase
      .from('meetings')
      .insert({
        title: 'Reunión de prueba',
        date: '2026-05-26',
        duration_minutes: 60,
        created_by: userId
      })
      .select()
      .single();

    if (insertMeetingError) throw insertMeetingError;
    console.log('✅ Meeting created:', meeting.id);

    // 3. Create 4 parts: 2 speakers, 2 students
    console.log('📋 Creating meeting parts...');
    const parts = [
      { meeting_id: meeting.id, role: 'speaker' },
      { meeting_id: meeting.id, role: 'speaker' },
      { meeting_id: meeting.id, role: 'student' },
      { meeting_id: meeting.id, role: 'student' },
    ];
    const { error: insertPartsError } = await supabase
      .from('meeting_parts')
      .insert(parts);

    if (insertPartsError) throw insertPartsError;

    console.log('🎉 Test setup completed successfully for meeting ID:', meeting.id);
  } catch (error) {
    console.error('❌ Error during test meeting creation:', error.message);
    process.exit(1);
  }
}

main();
