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
