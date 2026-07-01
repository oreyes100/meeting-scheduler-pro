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
CREATE TABLE IF NOT EXISTS part_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  part_type TEXT NOT NULL, -- e.g. 'chairman', 'prayer', 'student_part', 'assistant', etc.
  assigned_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_part_history_user_id ON part_history(user_id);
CREATE INDEX IF NOT EXISTS idx_part_history_assigned_date ON part_history(assigned_date);
CREATE INDEX IF NOT EXISTS idx_meeting_parts_meeting_id ON meeting_parts(meeting_id);
-- Persons List feature: extend the users table with full NW Scheduler person fields
-- This migration is additive and safe to re-run (all statements use IF NOT EXISTS / DO blocks).

-- ─── 1. NAMES ──────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suffix TEXT;

-- Backfill: if first_name/last_name are empty, derive from the legacy `name` column
UPDATE users SET first_name = split_part(name, ' ', 1) WHERE first_name IS NULL AND name IS NOT NULL;
UPDATE users SET last_name  = NULLIF(substring(name FROM position(' ' IN name) + 1), '')
  WHERE last_name IS NULL AND name IS NOT NULL AND position(' ' IN name) > 0;

-- ─── 2. CONTACT INFORMATION ────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lat_lng TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email2 TEXT;

-- ─── 3. PERSONAL INFORMATION ──────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')) DEFAULT 'male';
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_family_head BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;

-- ─── 4. SPIRITUAL STATUS / PRIVILEGES ─────────────────────────────────────────
-- (can_be_chairman, can_be_speaker, can_do_gems, can_do_bible_reading,
--  can_do_student_parts, can_be_assistant, can_do_prayers,
--  can_be_cbs_conducer, can_be_cbs_reader are added by update_schema_clm.sql)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_publisher BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_unbaptized_publisher BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_elder BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ministerial_servant BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_regular_pioneer BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_auxiliary_pioneer BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_special_pioneer BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auxiliary_pioneer_this_month BOOLEAN DEFAULT FALSE;

-- ─── 5. OTHER PERSON INFORMATION ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_elderly BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_infirm BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_child BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deaf BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blind BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_anointed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_kh_key BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ldc_volunteer BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_directly_to_branch BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_information BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_spiritual_1 BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_spiritual_2 BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_spiritual_3 BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_spiritual_4 BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_spiritual_5 BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_spiritual_6 BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disable_app_access BOOLEAN DEFAULT FALSE;

-- ─── 6. STATUS / LIFECYCLE ────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
  CHECK (status IN ('active', 'moved', 'removed'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS moved_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS moved_to_congregation TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

-- ─── 7. COMPUTED DISPLAY NAME ────────────────────────────────────────────────
UPDATE users
SET display_name = TRIM(BOTH ' ' FROM
  COALESCE(first_name, '') ||
  CASE WHEN middle_name IS NOT NULL AND middle_name <> '' THEN ' ' || middle_name ELSE '' END ||
  CASE WHEN last_name  IS NOT NULL AND last_name  <> '' THEN ' ' || last_name  ELSE '' END ||
  CASE WHEN suffix     IS NOT NULL AND suffix     <> '' THEN ' ' || suffix     ELSE '' END
)
WHERE display_name IS NULL;

-- ─── 8. INDEXES for fast list filtering / search ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_last_name  ON users(LOWER(last_name));
CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(LOWER(first_name));
CREATE INDEX IF NOT EXISTS idx_users_status     ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_gender     ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_is_active  ON users(is_active);
