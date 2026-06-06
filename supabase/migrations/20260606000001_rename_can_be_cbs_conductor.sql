-- Rename the misspelled `users.can_be_cbs_conducer` (with U) to
-- `users.can_be_cbs_conductor` (with E) to match every TypeScript reference
-- (Person type, API routes, auto-assign service, Persons page).
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
