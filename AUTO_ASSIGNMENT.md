# Automated Meeting Scheduler Assignment System

## Overview
This document details the automated process for assigning participants (users) to specific roles within a scheduled meeting. The system is designed to maximize resource utilization by adhering to strict availability constraints and minimizing scheduling conflicts across multiple parts of a single event.

### 🎯 Goal
To programmatically assign users to `meeting_parts` records, ensuring that:
1. Every required part has an assigned user if available.
2. No user is double-booked in the same meeting.
3. Assignments are optimized based on availability and role requirements.

## Architecture & Flow
The assignment logic resides in `src/services/auto-assign-service.js` and is triggered via the backend endpoint exposed by `meetings/backend/triggerAutoAssign.js`. It relies on a robust set of mocked (and soon to be production) API calls to the Supabase database.

**Data Flow:**
1. **Input:** `meetingId` (UUID).
2. **Retrieval:** Fetch all `meeting_parts` associated with the given `meetingId`.
3. **User Pool Generation:** Query and compile a list of *all* active users in the system (`user-1`, `user-2`, etc.) along with their full availability windows (start/end time).
4. **Assignment Loop:** Iteratively assign parts based on a calculated priority queue (see Strategy below).
5. **Output:** Update the `meeting_parts` records with `assigned_user_id` and return a summary report.

## 🛠️ Assignment Strategy (Critical)
The core algorithm implements a multi-tiered heuristic to ensure optimal assignment:

### 1. Role Priority (Scarcity Principle)
Roles are prioritized not by their defined importance, but by the *scarcity of available users* for that role across all parts in the meeting. The system attempts to fill parts requiring rare roles first.

### 2. User Assignment Heuristic (The "Least Flexible First" Rule)
When multiple parts need filling, or when assigning multiple parts to different users:
- **Priority is given to users with the smallest overall available window.** By assigning a user with limited availability first, we secure their slot before they become unavailable due to other scheduling conflicts. This prevents hard-to-fill slots from being left until all highly flexible users are exhausted.

### 3. Conflict Prevention
The process strictly maintains a set of `AssignedUserIDs` for the current meeting instance. Any user found in this set cannot be assigned again, preventing double-booking errors.

## 🚀 Usage Example (CLI)
To trigger the assignment logic:

1.  **Setup Test Data:**
    ```bash
    # Run to create a meeting and multiple parts with null assignments
    node createTestMeeting.js 
    ```
2.  **Execute Assignment:**
    ```bash
    # Replace <meeting_id> with the ID returned in step 1
    node meetings/backend/triggerAutoAssign.js <meeting_id>
    ```

**Expected Console Output (Success):** The console should confirm that assignments were made and provide a clear summary: `✅ Auto-assignment completed – X/X parts assigned.`

## 🐛 Troubleshooting & Known Issues
*   **Error:** `invalid input syntax for type uuid`: This usually means the provided meeting ID does not exist in the database. Ensure the UUID is valid.
*   **Edge Case (No Users):** If no users are found or have availability, the system handles this gracefully by reporting failure instead of crashing.

## 📚 Implementation Details
*   **Service File:** `src/services/auto-assign-service.js`
*   **Trigger Script:** `meetings/backend/triggerAutoAssign.js`
*   **Dependencies:** Requires `@supabase/supabase-js` and environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
