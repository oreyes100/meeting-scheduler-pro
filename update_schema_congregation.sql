-- Congregation settings (single-row table)
-- Run in Supabase SQL Editor or via /api/migrate-congregation

CREATE TABLE IF NOT EXISTS congregation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  number TEXT,
  congregation_id TEXT,
  language TEXT DEFAULT 'es',
  time_zone TEXT,
  weekend_meeting_day TEXT DEFAULT 'sunday',
  weekend_meeting_time TEXT DEFAULT '10:00',
  midweek_meeting_day TEXT DEFAULT 'thursday',
  midweek_meeting_time TEXT DEFAULT '19:30',
  zoom_meeting_id TEXT,
  zoom_password TEXT,
  zoom_link TEXT,
  dial_in_number TEXT,
  kingdom_hall_address TEXT,
  circuit TEXT,
  co_name TEXT,
  co_contact_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a single empty row if table is empty
INSERT INTO congregation_settings (name)
SELECT NULL
WHERE NOT EXISTS (SELECT 1 FROM congregation_settings);

NOTIFY pgrst, 'reload schema';
