-- 3. Add meeting‑level role columns
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS chairman_id UUID,
  ADD COLUMN IF NOT EXISTS opening_prayer_id UUID,
  ADD COLUMN IF NOT EXISTS closing_prayer_id UUID,
  ADD COLUMN IF NOT EXISTS cbs_conducer_id UUID,
  ADD COLUMN IF NOT EXISTS cbs_reader_id UUID;

-- 4. Create part_history table (keep it if it does not exist yet)
CREATE TABLE IF NOT EXISTS part_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_part_id UUID REFERENCES meeting_parts(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('speaker','student')),
  class_type TEXT
);

-- 5. Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_part_history_meeting_part ON part_history(meeting_part_id);
CREATE INDEX IF NOT EXISTS idx_part_history_assigned_at ON part_history(assigned_at);
