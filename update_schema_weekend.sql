-- Weekend Meeting / Public Talks schema
-- Run in Supabase SQL Editor or via /api/migrate-weekend

-- 1. Public Talk Outlines catalog (CRUD from UI)
CREATE TABLE IF NOT EXISTS public_talk_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Visiting Public Speakers (neighbor congregations)
CREATE TABLE IF NOT EXISTS public_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  congregation TEXT NOT NULL,
  city TEXT,
  phone TEXT,
  email TEXT,
  outline_numbers INTEGER[] DEFAULT '{}',  -- outlines this speaker can give
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Weekend meetings (one row per week)
CREATE TABLE IF NOT EXISTS weekend_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,             -- Monday of the week
  -- Speaker: local (persons) or visiting (public_speakers)
  speaker_type TEXT CHECK (speaker_type IN ('local', 'visiting', 'other')) DEFAULT 'local',
  local_speaker_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  visiting_speaker_id UUID REFERENCES public_speakers(id) ON DELETE SET NULL,
  other_speaker_name TEXT,              -- free-text for circuit overseer etc.
  -- Talk
  outline_id UUID REFERENCES public_talk_outlines(id) ON DELETE SET NULL,
  special_talk_title TEXT,             -- free-text for special outlines
  song INTEGER,
  speaker_confirmed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  -- Weekend assignments
  chairman_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  wt_conductor_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  wt_reader_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  hospitality_person_id UUID REFERENCES persons(id) ON DELETE SET NULL,
  hospitality_text TEXT,               -- free-text fallback
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add can_give_public_talk flag to persons
ALTER TABLE persons ADD COLUMN IF NOT EXISTS can_give_public_talk BOOLEAN DEFAULT FALSE;

-- 5. Track outline last-given history per congregation
CREATE TABLE IF NOT EXISTS public_talk_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outline_id UUID NOT NULL REFERENCES public_talk_outlines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  speaker_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
