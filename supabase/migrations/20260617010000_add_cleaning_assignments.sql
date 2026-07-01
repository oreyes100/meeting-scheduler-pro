create table if not exists cleaning_assignments (
  id uuid primary key default gen_random_uuid(),
  week_date text not null unique,
  assignments jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
