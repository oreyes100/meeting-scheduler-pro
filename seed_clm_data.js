import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

const publishers = [
  { name: 'Sandy Reavely', email: 'sandy.reavely@example.com', gender: 'male', can_be_chairman: true, can_be_speaker: true, can_do_gems: true, can_do_prayers: true, can_be_cbs_conducer: true },
  { name: 'George Bonadurer', email: 'george.bonadurer@example.com', gender: 'male', can_be_chairman: true, can_be_speaker: true, can_do_gems: true, can_do_prayers: true, can_be_cbs_conducer: true },
  { name: 'Hung Roggenbaum', email: 'hung.roggenbaum@example.com', gender: 'male', can_be_speaker: true, can_do_gems: true, can_do_prayers: true },
  { name: 'Merle Horgen', email: 'merle.horgen@example.com', gender: 'male', can_be_speaker: true, can_do_gems: true, can_do_prayers: true },
  { name: 'Fausto Phanthavongsa', email: 'fausto.p@example.com', gender: 'male', can_do_bible_reading: true, can_do_student_parts: true, can_be_assistant: true },
  { name: 'Lina Antle123', email: 'lina.antle@example.com', gender: 'female', can_do_student_parts: true, can_be_assistant: true },
  { name: 'Tawny Mahala', email: 'tawny.mahala@example.com', gender: 'female', can_do_student_parts: true, can_be_assistant: true },
  { name: 'Carolann Slemmons', email: 'carolann.s@example.com', gender: 'female', can_do_student_parts: true, can_be_assistant: true },
  { name: 'Diedra Chimes', email: 'diedra.chimes@example.com', gender: 'female', can_do_student_parts: true, can_be_assistant: true },
  { name: 'Honey Kozak', email: 'honey.kozak@example.com', gender: 'female', can_do_student_parts: true, can_be_assistant: true },
  { name: 'Marylynn Kosters', email: 'marylynn.k@example.com', gender: 'female', can_do_student_parts: true, can_be_assistant: true },
  { name: 'Gustavo Serens', email: 'gustavo.serens@example.com', gender: 'male', can_be_chairman: true, can_be_speaker: true, can_do_gems: true, can_do_prayers: true, can_be_cbs_conducer: true },
  { name: 'Maxwell Transou', email: 'maxwell.t@example.com', gender: 'male', can_be_chairman: true, can_be_speaker: true, can_do_gems: true, can_do_prayers: true, can_be_cbs_conducer: true },
  { name: 'Kip Alfrey123', email: 'kip.alfrey@example.com', gender: 'male', can_be_cbs_reader: true, can_do_prayers: true },
  { name: 'Dalton Priewe', email: 'dalton.priewe@example.com', gender: 'male', can_do_prayers: true }
];

async function runSeeder() {
  try {
    console.log('🧹 Clearing old data (meetings & meeting_parts)...');
    
    // We can't delete users easily if there's CASCADE but let's delete them.
    // To be safe, delete meeting_parts, meetings, then users.
    await supabase.from('meeting_parts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('meetings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('👤 Inserting publishers...');
    const { data: insertedUsers, error: usersError } = await supabase
      .from('users')
      .insert(publishers)
      .select();

    if (usersError) throw usersError;
    console.log(`✅ Seeded ${insertedUsers.length} publishers`);

    // Helper map
    const userMap = {};
    insertedUsers.forEach(u => {
      userMap[u.name] = u.id;
    });

    console.log('📅 Inserting meetings...');
    const meetingsToInsert = [
      {
        title: 'Life and Ministry Meeting',
        date: '2024-01-08',
        duration_minutes: 105,
        song_opening: 30,
        song_middle: 58,
        song_closing: 138,
        chairman_id: userMap['Sandy Reavely'],
        opening_prayer_id: userMap['George Bonadurer'],
        cbs_conducer_id: userMap['Maxwell Transou'],
        cbs_reader_id: userMap['Kip Alfrey123'],
        closing_prayer_id: userMap['Dalton Priewe'],
        is_published: true
      },
      {
        title: 'Life and Ministry Meeting',
        date: '2024-01-15',
        duration_minutes: 105,
        song_opening: 45,
        song_middle: 80,
        song_closing: 142,
        is_published: false
      }
    ];

    const { data: insertedMeetings, error: meetingsError } = await supabase
      .from('meetings')
      .insert(meetingsToInsert)
      .select();

    if (meetingsError) throw meetingsError;
    console.log(`✅ Seeded ${insertedMeetings.length} meetings`);

    const meeting1 = insertedMeetings[0];
    const meeting2 = insertedMeetings[1];

    console.log('📋 Inserting meeting parts for meeting 1 (January 08-14)...');
    const partsMeeting1 = [
      {
        meeting_id: meeting1.id,
        class_type: 'main',
        part_type: 'treasures_talk',
        part_number: 1,
        title: '1. When Life Seems Unfair',
        duration_minutes: 10,
        assigned_user_id: userMap['Hung Roggenbaum'],
        role: 'speaker'
      },
      {
        meeting_id: meeting1.id,
        class_type: 'main',
        part_type: 'spiritual_gems',
        part_number: 2,
        title: '2. Spiritual Gems',
        duration_minutes: 10,
        assigned_user_id: userMap['Merle Horgen'],
        role: 'speaker'
      },
      {
        meeting_id: meeting1.id,
        class_type: 'main',
        part_type: 'bible_reading',
        part_number: 3,
        title: '3. Bible Reading',
        duration_minutes: 4,
        assigned_user_id: userMap['Fausto Phanthavongsa'],
        role: 'student'
      },
      {
        meeting_id: meeting1.id,
        class_type: 'main',
        part_type: 'student_part',
        part_number: 4,
        title: '4. Starting a Conversation',
        student_part_type: 'starting_conversation',
        duration_minutes: 3,
        assigned_user_id: userMap['Lina Antle123'],
        assistant_user_id: userMap['Tawny Mahala'],
        role: 'student'
      },
      {
        meeting_id: meeting1.id,
        class_type: 'main',
        part_type: 'student_part',
        part_number: 5,
        title: '5. Starting a Conversation',
        student_part_type: 'starting_conversation',
        duration_minutes: 4,
        assigned_user_id: userMap['Carolann Slemmons'],
        assistant_user_id: userMap['Diedra Chimes'],
        role: 'student'
      },
      {
        meeting_id: meeting1.id,
        class_type: 'main',
        part_type: 'student_part',
        part_number: 6,
        title: '6. Making Disciples',
        student_part_type: 'making_disciples',
        duration_minutes: 5,
        assigned_user_id: userMap['Honey Kozak'],
        assistant_user_id: userMap['Marylynn Kosters'],
        role: 'student'
      },
      {
        meeting_id: meeting1.id,
        class_type: 'main',
        part_type: 'living_part',
        part_number: 7,
        title: "7. Are You Motivated to 'Preach the Word' Informally?",
        duration_minutes: 15,
        assigned_user_id: userMap['Gustavo Serens'],
        role: 'speaker'
      }
    ];

    const { error: partsError } = await supabase
      .from('meeting_parts')
      .insert(partsMeeting1);

    if (partsError) throw partsError;
    console.log('✅ Seeded meeting parts for January 08-14');

    console.log('📋 Inserting default (empty) parts for meeting 2 (January 15-21)...');
    const partsMeeting2 = [
      {
        meeting_id: meeting2.id,
        class_type: 'main',
        part_type: 'treasures_talk',
        part_number: 1,
        title: '1. Treasures talk title',
        duration_minutes: 10,
        role: 'speaker'
      },
      {
        meeting_id: meeting2.id,
        class_type: 'main',
        part_type: 'spiritual_gems',
        part_number: 2,
        title: '2. Spiritual Gems',
        duration_minutes: 10,
        role: 'speaker'
      },
      {
        meeting_id: meeting2.id,
        class_type: 'main',
        part_type: 'bible_reading',
        part_number: 3,
        title: '3. Bible Reading',
        duration_minutes: 4,
        role: 'student'
      },
      {
        meeting_id: meeting2.id,
        class_type: 'main',
        part_type: 'student_part',
        part_number: 4,
        title: '4. Student talk title',
        student_part_type: 'starting_conversation',
        duration_minutes: 3,
        role: 'student'
      },
      {
        meeting_id: meeting2.id,
        class_type: 'main',
        part_type: 'student_part',
        part_number: 5,
        title: '5. Student talk title',
        student_part_type: 'following_up',
        duration_minutes: 4,
        role: 'student'
      },
      {
        meeting_id: meeting2.id,
        class_type: 'main',
        part_type: 'living_part',
        part_number: 7,
        title: '7. Living part title',
        duration_minutes: 15,
        role: 'speaker'
      }
    ];

    const { error: parts2Error } = await supabase
      .from('meeting_parts')
      .insert(partsMeeting2);

    if (parts2Error) throw parts2Error;
    console.log('✅ Seeded meeting parts for January 15-21');

    console.log('🎉 Database seeding completed successfully!');
  } catch (err) {
    console.error('❌ Error during seeding:', err.message || err);
    process.exit(1);
  }
}

runSeeder();
