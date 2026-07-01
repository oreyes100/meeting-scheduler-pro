create table if not exists outgoing_talks (
  id uuid primary key default gen_random_uuid(),
  week_date text not null,
  user_id uuid references users(id) on delete cascade,
  congregation_name text,
  talk_number integer,
  notes text,
  created_at timestamptz default now()
);

create table if not exists congregation_tasks (
  id uuid primary key default gen_random_uuid(),
  week_date text not null unique,
  assignments jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
