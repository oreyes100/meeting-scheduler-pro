-- 1. Add class_type column to meeting_parts table
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS class_type TEXT;

-- 2. Create part_history table to store historical assignments
CREATE TABLE IF NOT EXISTS part_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_part_id UUID REFERENCES meeting_parts(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('speaker', 'student')),
  class_type TEXT
);

-- 3. Create index for faster queries on part_history
CREATE INDEX IF NOT EXISTS idx_part_history_meeting_part ON part_history(meeting_part_id);
CREATE INDEX IF NOT EXISTS idx_part_history_assigned_at ON part_history(assigned_at);
