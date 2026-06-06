-- DDL Migration Script for New World Scheduler CLM features
-- INSTRUCTIONS: Copy this code and run it in the SQL Editor of your Supabase dashboard.

-- 1. Extend the users table with gender, active status, and role capabilities
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')) DEFAULT 'male';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_chairman BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_speaker BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_do_gems BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_do_bible_reading BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_do_student_parts BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_assistant BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_do_prayers BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_cbs_conducer BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_be_cbs_reader BOOLEAN DEFAULT FALSE;

-- 2. Extend the meetings table with song selections, key role assignments, and publication status
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS song_opening INTEGER;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS song_middle INTEGER;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS song_closing INTEGER;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS chairman_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS opening_prayer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS closing_prayer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS cbs_conducer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS cbs_reader_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- 3. Extend the meeting_parts table with auxiliary class, titles, durations, study points, and assistant support
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS class_type TEXT CHECK (class_type IN ('main', 'aux_1', 'aux_2')) DEFAULT 'main';
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS part_type TEXT DEFAULT 'student_part'; -- e.g., 'treasures_talk', 'spiritual_gems', 'bible_reading', 'student_part', 'living_part'
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS part_number INTEGER;
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 5;
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS assistant_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS study_point TEXT;
ALTER TABLE meeting_parts ADD COLUMN IF NOT EXISTS student_part_type TEXT; -- e.g. 'starting_conversation', 'following_up', 'making_disciples', 'explaining_beliefs', 'talk', 'none'

-- 4. Re-create the part_history table if it doesn't exist
-- (Use a DO block so we don't conflict with existing tables that have a different schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'part_history') THEN
    CREATE TABLE part_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      part_type TEXT NOT NULL,
      assigned_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 5. Indexes for fast lookup (only create if the column exists, in case part_history was created with a different schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='part_history' AND column_name='user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_part_history_user_id ON part_history(user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='part_history' AND column_name='assigned_date') THEN
    CREATE INDEX IF NOT EXISTS idx_part_history_assigned_date ON part_history(assigned_date);
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='part_history' AND column_name='assigned_at') THEN
    CREATE INDEX IF NOT EXISTS idx_part_history_assigned_at ON part_history(assigned_at);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_meeting_parts_meeting_id ON meeting_parts(meeting_id);
