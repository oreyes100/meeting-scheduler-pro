-- Mantenimiento
create table if not exists maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  link text,
  description text,
  done boolean default false,
  assigned_to jsonb default '[]',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Visita Superintendente de Circuito
create table if not exists circuit_overseer_visits (
  id uuid primary key default gen_random_uuid(),
  week_date text not null,
  host_id uuid references users(id),
  co_companions jsonb default '[]',
  wife_companions jsonb default '[]',
  activities jsonb default '[]',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Conmemoración (Memorial) - role definitions + assignments
create table if not exists memorial_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  positions integer default 1,
  assigned_to jsonb default '[]',
  sort_order integer default 0
);

-- Eventos
create table if not exists congregation_events (
  id uuid primary key default gen_random_uuid(),
  type text,
  name text,
  description text,
  link text,
  start_date text,
  end_date text,
  single_day boolean default false,
  show_start_time boolean default false,
  show_end_time boolean default false,
  group_name text,
  created_at timestamptz default now()
);
