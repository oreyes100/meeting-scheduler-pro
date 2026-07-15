-- Multi-congregation support
-- Adds congregations table + congregation_id to all data tables.
-- Existing data migrates to default congregation (La Estación).

-- 1. Congregations table
create table if not exists congregations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  enabled boolean not null default true,
  -- Array of module keys this congregation is allowed to access
  enabled_modules text[] not null default array[
    'congregation','persons','meetings','weekend','public-talks',
    'territories','field-service','field-service-reports','public-witnessing',
    'attendance','responsibilities','tasks','cleaning','maintenance',
    'co-visit','memorial','events','my-report','group-reports',
    'permissions','backup','cuentas'
  ],
  created_at timestamptz default now()
);

-- 2. Insert default congregation
insert into congregations (name, city)
values ('La Estación', 'Pátzcuaro')
on conflict do nothing;

-- 3. Super-admin flag + congregation_id on users
alter table users add column if not exists congregation_id uuid references congregations(id);
alter table users add column if not exists is_super_admin boolean not null default false;

-- 4. Set super-admin for oreyes100
update users set is_super_admin = true
where auth_email = 'oreyes100@gmail.com';

-- 5. Assign all existing users to default congregation
update users set congregation_id = (select id from congregations where name = 'La Estación' limit 1)
where congregation_id is null;

-- 6. Add congregation_id to all data tables
alter table meetings add column if not exists congregation_id uuid references congregations(id);
alter table weekend_meetings add column if not exists congregation_id uuid references congregations(id);
alter table field_service_groups add column if not exists congregation_id uuid references congregations(id);
alter table field_service_meetings add column if not exists congregation_id uuid references congregations(id);
alter table field_service_reports add column if not exists congregation_id uuid references congregations(id);
alter table territories add column if not exists congregation_id uuid references congregations(id);
alter table public_speakers add column if not exists congregation_id uuid references congregations(id);
alter table outgoing_talks add column if not exists congregation_id uuid references congregations(id);
alter table pw_locations add column if not exists congregation_id uuid references congregations(id);
alter table congregation_tasks add column if not exists congregation_id uuid references congregations(id);
alter table cleaning_assignments add column if not exists congregation_id uuid references congregations(id);
alter table maintenance_tasks add column if not exists congregation_id uuid references congregations(id);
alter table circuit_overseer_visits add column if not exists congregation_id uuid references congregations(id);
alter table memorial_roles add column if not exists congregation_id uuid references congregations(id);
alter table congregation_events add column if not exists congregation_id uuid references congregations(id);
alter table congregation_roles add column if not exists congregation_id uuid references congregations(id);
alter table meeting_attendance add column if not exists congregation_id uuid references congregations(id);

-- 7. Fix unique constraints that need congregation_id scope
-- cleaning_assignments: was unique(week_date), now unique(week_date, congregation_id)
alter table cleaning_assignments drop constraint if exists cleaning_assignments_week_date_key;
alter table cleaning_assignments add constraint cleaning_assignments_week_congre_key unique (week_date, congregation_id);

-- congregation_tasks: week_date was effectively unique per table, now per congregation
alter table congregation_tasks drop constraint if exists congregation_tasks_week_date_key;
alter table congregation_tasks add constraint congregation_tasks_week_congre_key unique (week_date, congregation_id);

-- meeting_attendance: was unique(meeting_date, meeting_type), now includes congregation
alter table meeting_attendance drop constraint if exists meeting_attendance_meeting_date_meeting_type_key;
alter table meeting_attendance add constraint meeting_attendance_date_type_congre_key unique (meeting_date, meeting_type, congregation_id);

-- 8. Migrate all existing rows in data tables to default congregation
do $$
declare
  default_id uuid;
begin
  select id into default_id from congregations where name = 'La Estación' limit 1;

  update meetings set congregation_id = default_id where congregation_id is null;
  update weekend_meetings set congregation_id = default_id where congregation_id is null;
  update field_service_groups set congregation_id = default_id where congregation_id is null;
  update field_service_meetings set congregation_id = default_id where congregation_id is null;
  update field_service_reports set congregation_id = default_id where congregation_id is null;
  update territories set congregation_id = default_id where congregation_id is null;
  update public_speakers set congregation_id = default_id where congregation_id is null;
  update outgoing_talks set congregation_id = default_id where congregation_id is null;
  update pw_locations set congregation_id = default_id where congregation_id is null;
  update congregation_tasks set congregation_id = default_id where congregation_id is null;
  update cleaning_assignments set congregation_id = default_id where congregation_id is null;
  update maintenance_tasks set congregation_id = default_id where congregation_id is null;
  update circuit_overseer_visits set congregation_id = default_id where congregation_id is null;
  update memorial_roles set congregation_id = default_id where congregation_id is null;
  update congregation_events set congregation_id = default_id where congregation_id is null;
  update congregation_roles set congregation_id = default_id where congregation_id is null;
  update meeting_attendance set congregation_id = default_id where congregation_id is null;
end $$;
