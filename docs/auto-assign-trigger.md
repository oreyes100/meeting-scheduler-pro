## Running the auto‑assigner
```bash
# 1️⃣ Install dependencies (if not already)
npm install

# 2️⃣ Ensure you have the Supabase service‑role key in .env
#    (replace the publishable key)

# 3️⃣ Create a test meeting (optional)
node createTestMeeting.js

# 4️⃣ Run the trigger for a specific meeting
node meetings/backend/triggerAutoAssign.js <meeting_id>
```
