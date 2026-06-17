-- Public Witnessing Cart Scheduler tables

create table if not exists pw_locations (
  id uuid primary key default gen_random_uuid(),
  cart_number integer not null,
  name text not null,
  address text,
  map_link text,
  notes text,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists pw_shifts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references pw_locations(id) on delete cascade,
  day_of_week text not null,
  start_time text not null,
  end_time text not null,
  persons_needed integer default 2,
  sort_order integer default 0
);

create table if not exists pw_assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references pw_shifts(id) on delete cascade,
  week_date text not null,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(shift_id, week_date, user_id)
);
