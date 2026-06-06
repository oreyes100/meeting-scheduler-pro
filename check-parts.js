import { supabase } from './meetings/backend/autoAssign.js';

async function main() {
  try {
    console.log('🔍 Checking meeting parts...');
    
    const { data: parts, error } = await supabase
      .from('meeting_parts')
      .select('*');
    
    if (error) throw error;
    
    console.log(`📊 Found ${parts.length} meeting parts:`);
    parts.forEach((part, index) => {
      console.log(`  ${index + 1}. ID: ${part.id}`);
      console.log(`     Meeting ID: ${part.meeting_id}`);
      console.log(`     Role: ${part.role}`);
      console.log(`     Assigned User ID: ${part.assigned_user_id || 'NULL (unassigned)'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error checking meeting parts:', error.message);
    process.exit(1);
  }
}

main();