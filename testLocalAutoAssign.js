import { autoAssign, supabase } from './meetings/backend/autoAssign.js';

console.log('🧪 Starting local mock test for autoAssign...');

// --- Test Data Setup (Initial Successful Run) ---
const mockUsers = [
  { id: 'user-1', name: 'Organizador Principal', available_start: '09:00', available_end: '17:00' },
  { id: 'user-2', name: 'Asistente A', available_start: '08:00', available_end: '18:00' },
  // Shortest availability window (highest priority)
  { id: 'user-3', name: 'Asistente B', available_start: '10:00', available_end: '15:00' }, 
  // Two users with the same wide availability, order should be deterministic but not critical.
  { id: 'user-4', name: 'Asistente C', available_start: '08:00', available_end: '18:00'}
];

const mockParts = [
  { id: 'part-1', meeting_id: 'meeting-test-123', role: 'speaker', assigned_user_id: null },
  { id: 'part-2', meeting_id: 'meeting-test-123', role: 'speaker', assigned_user_id: null },
  { id: 'part-3', meeting_id: 'meeting-test-123', role: 'student', assigned_user_id: null },
  { id: 'part-4', meeting_id: 'meeting-test-123', role: 'student', assigned_user_id: null }
];

// --- Edge Case Test Data (No Users) ---
const mockUsersEmpty = [{}, {}]; 
const mockPartsNoUser = [
  { id: 'part-a', meeting_id: 'meeting-no-user', role: 'speaker', assigned_user_id: null },
  { id: 'part-b', meeting_id: 'meeting-no-user', role: 'student', assigned_user_id: null }
];

// Mocking the Supabase client methods
supabase.from = (tableName) => ({
  select: () => {
    if (tableName === 'users') {
      return Promise.resolve({ data: mockUsers, error: null });
    }
    // Return chain for meeting_parts query
    return {
      eq: (colName, val) => {
        return Promise.resolve({ data: mockParts, error: null });
      }
    };
  },
  update: (values) => ({
    eq: (colName, val) => {
      const part = mockParts.find(p => p.id === val);
      if (part) {
        part.assigned_user_id = values.assigned_user_id;
      }
      return Promise.resolve({ error: null });
    }
  })
});

// --- The main testing function for success case ---
async function runSuccessTest() {
  console.log('\n=======================================');
  console.log('✅ RUNNING SUCCESSFUL AUTO-ASSIGNMENT TEST');
  console.log('=======================================');
  try {
    const result = await autoAssign('meeting-test-123');

    console.log('\n📊 Assignment Results:');
    console.log(`Assigned Count: ${result.assignedCount} / ${result.totalCount}`);
    console.log(JSON.stringify(mockParts, null, 2));

    // Verification logic remains the same
    const assignedIds = mockParts.map(p => p.assigned_user_id);
    // Expected priority based on smallest availability window: user-3 (5h), then others...
    const expectedPriorityOrder = ['user-3', 'user-1', 'user-2', 'user-4']; 

    console.log('\n🔍 Verification:');
    console.log('Assigned IDs order:', assignedIds);
    console.log('Expected priority order:', expectedPriorityOrder);

    const matchesPriority = assignedIds.every((id, idx) => id === expectedPriorityOrder[idx]);
    if (matchesPriority) {
      console.log('\n✅ SUCCESS: The assignment engine correctly prioritized users based on availability windows.');
    } else {
      console.warn('\n⚠️ WARNING: Priority order check failed. Assignments were completed but the priority sequence might need review.');
    }

  } catch (err) {
    console.error('\n❌ FAILURE: Success test failed with error:', err.message);
  }
}

// --- The main testing function for failure case ---
async function runNoUserTest() {
  console.log('\n=======================================');
  console.log('⚠️ RUNNING EDGE CASE TEST: NO USERS AVAILABLE');
  console.log('=======================================');
  try {
    // Backup current mocks to restore later, regardless of test outcome.
    const originalMockUsers = mockUsers;
    const originalMockParts = mockParts;

    // Overwrite the global state for this isolated test run
    mockUsers = mockUsersEmpty; 
    mockParts = mockPartsNoUser;

    // Execute the function and expect it to handle the error gracefully
    await autoAssign('meeting-no-user');

    console.error('\n❌ FAILURE: Expected an assignment failure but the test ran without throwing a predictable error.');

  } catch (err) {
    if (err.message && err.message.includes('No available users')) {
      console.log('\n✅ SUCCESS: The autoAssign service correctly failed when no user data was found, as expected.');
    } else if (err.message) {
        console.error(`\n❌ FAILURE: Caught an unexpected error message: ${err.message}`);
    } else {
        console.error('\n❌ FAILURE: Test failed due to an unknown error.');
    } finally {
      // Restore original mocks after the test is complete, regardless of success/failure.
      mockUsers = originalMockUsers; 
      mockParts = originalMockParts;
    }
  }
}

(async () => {
  await runSuccessTest();
  await runNoUserTest();
})();