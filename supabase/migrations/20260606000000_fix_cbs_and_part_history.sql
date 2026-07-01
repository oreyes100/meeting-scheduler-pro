-- Fix two schema bugs surfaced during the June 2026 update:
--   1. `meetings.cbs_conductor_id` was misspelled `cbs_conducer_id` (with a U).
--      The auto-assign service and the new meeting API route were writing to
--      a column that didn't exist, so CBS conductor assignments were silently
--      dropped. Rename the column and rebuild any code references.
--   2. `part_history.role` had a CHECK constraint that only allowed
--      'speaker' / 'student'. The auto-assign service writes many more role
--      values ('chairman', 'opening_prayer', 'closing_prayer',
--      'cbs_conductor', 'cbs_reader', 'treasures_talk', 'spiritual_gems',
--      'bible_reading', 'student_part', 'living_part', 'assistant'),
--      so EVERY insert was failing. Broaden the check.
--   3. `part_history` is also missing the `part_type` and `assigned_date`
--      columns that auto-assign-service.js writes. Add them (nullable so
--      legacy rows keep working).

-- 1. Rename CBS conductor column on `meetings`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'cbs_conducer_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'meetings' AND column_name = 'cbs_conductor_id'
  ) THEN
    ALTER TABLE public.meetings RENAME COLUMN cbs_conducer_id TO cbs_conductor_id;
  END IF;
END$$;

-- 1b. Same misspelling on `users.can_be_cbs_conducer`. The Typescript code
--     (Person type, API routes, auto-assign service, Persons page) all use
--     `can_be_cbs_conductor`. Rename so they line up.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_be_cbs_conducer'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_be_cbs_conductor'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN can_be_cbs_conducer TO can_be_cbs_conductor;
  END IF;
END$$;

-- 2. Drop the restrictive role CHECK and add the wider one.
ALTER TABLE public.part_history DROP CONSTRAINT IF EXISTS part_history_role_check;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.part_history'::regclass
      AND contype = 'c'
      AND conname = 'part_history_role_check'
  ) THEN
    ALTER TABLE public.part_history
      ADD CONSTRAINT part_history_role_check
      CHECK (role IN (
        'speaker','student','assistant',
        'chairman','opening_prayer','closing_prayer',
        'cbs_conductor','cbs_reader',
        'treasures_talk','spiritual_gems','bible_reading',
        'student_part','living_part','cbs'
      ));
  END IF;
END$$;

-- 3. Add missing part_type / assigned_date columns.
ALTER TABLE public.part_history
  ADD COLUMN IF NOT EXISTS part_type TEXT,
  ADD COLUMN IF NOT EXISTS assigned_date DATE;

-- Indexes for the per-role LRA lookup the auto-assign service now performs.
CREATE INDEX IF NOT EXISTS idx_part_history_user_parttype_date
  ON public.part_history (user_id, part_type, assigned_date DESC);
CREATE INDEX IF NOT EXISTS idx_part_history_assigned_date
  ON public.part_history (assigned_date);
