-- Public speaker scope: mark a speaker as local and/or outgoing (visiting other congregations)
-- Run in Supabase SQL Editor.

ALTER TABLE users ADD COLUMN IF NOT EXISTS speaker_local BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS speaker_visiting BOOLEAN DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
