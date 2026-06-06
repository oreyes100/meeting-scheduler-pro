// launch-auto-assign.js
// Simple launcher for the auto‑assignment engine.
// Usage: node launch-auto-assign.js <meeting_id>

import { autoAssign } from './meetings/backend/autoAssign.js';

const meetingId = process.argv[2];
if (!meetingId) {
  console.error('❌ Error: Please provide a meeting_id as an argument.');
  console.error('Usage: node launch-auto-assign.js <meeting_id>');
  process.exit(1);
}

(async () => {
  try {
    const result = await autoAssign(meetingId);
    console.log(`✅ Auto‑assignment completed – ${result.assignedCount}/${result.totalCount} parts assigned.`);
  } catch (error) {
    console.error('❌ Auto‑assignment failed:', error.message);
    process.exit(1);
  }
})();
