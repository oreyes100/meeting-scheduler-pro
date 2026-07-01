import { supabase } from './meetings/backend/autoAssign.js';

async function main() {
  try {
    console.log('🔍 Checking meetings in database...');
    
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('*')
      .order('id', { ascending: false });
    
    if (error) throw error;
    
    console.log(`📊 Found ${meetings.length} meetings:`);
    meetings.forEach((meeting, index) => {
      console.log(`  ${index + 1}. ID: ${meeting.id}`);
      console.log(`     Title: ${meeting.title}`);
      console.log(`     Date: ${meeting.date}`);
      console.log(`     Duration: ${meeting.duration_minutes} minutes`);
      console.log(`     Created by: ${meeting.created_by}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking meetings:', error.message);
    process.exit(1);
  }
}

main();