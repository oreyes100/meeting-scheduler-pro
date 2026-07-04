-- Add location, details, requires_assistant columns to meeting_parts
ALTER TABLE meeting_parts
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS requires_assistant BOOLEAN DEFAULT false;

-- Create part_snapshots table for backup/undo of rebuild-parts
CREATE TABLE IF NOT EXISTS part_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  restored BOOLEAN DEFAULT false,
  restored_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_part_snapshots_meeting ON part_snapshots(meeting_id);
CREATE INDEX IF NOT EXISTS idx_part_snapshots_created ON part_snapshots(created_at DESC);
