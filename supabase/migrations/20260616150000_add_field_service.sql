-- Field Service Groups
create table if not exists field_service_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meeting_day text, -- e.g. 'saturday'
  meeting_time text, -- e.g. '09:30'
  meeting_location text,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Group members
create table if not exists field_service_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references field_service_groups(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text default 'member', -- 'group_overseer', 'group_assistant', 'member'
  sort_order integer default 0,
  unique(group_id, user_id)
);

-- Field Service Meetings (weekly schedule entries)
create table if not exists field_service_meetings (
  id uuid primary key default gen_random_uuid(),
  week_date text not null, -- Monday ISO date of the week
  day_of_week text not null, -- 'monday','tuesday',...'sunday'
  time_period text default 'am', -- 'am' or 'pm'
  meeting_time text, -- e.g. '09:30'
  location text,
  conductor_id uuid references users(id),
  zoom_host_id uuid references users(id),
  territory text,
  notes text,
  group_id uuid references field_service_groups(id),
  cart_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_fsm_week on field_service_meetings(week_date);
create index if not exists idx_fsgm_group on field_service_group_members(group_id);
