create table if not exists meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  meeting_type text not null check (meeting_type in ('midweek', 'weekend')),
  in_person integer,
  online integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(meeting_date, meeting_type)
);
