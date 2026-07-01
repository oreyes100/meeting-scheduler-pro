import { autoAssign } from './autoAssign.js';

async function main() {
  const meetingId = process.argv[2];

  if (!meetingId) {
    console.error('❌ Error: Please provide a meeting_id as an argument.');
    console.error('Usage: node meetings/backend/triggerAutoAssign.js <meeting_id>');
    process.exit(1);
  }

  try {
    const { assignedCount, totalCount } = await autoAssign(meetingId);
    console.log(`✅ Auto-assignment completed – ${assignedCount}/${totalCount} parts assigned.`);
  } catch (error) {
    console.error('❌ Error during auto-assignment:', error.message);
    process.exit(1);
  }
}

main();
