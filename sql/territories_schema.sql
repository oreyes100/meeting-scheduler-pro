-- ─── Territorios (módulo de predicación) ─────────────────────────────────────
-- Adaptado de TerritoryJW (Firestore) al stack Supabase/Postgres.
-- Ejecutar en el SQL Editor de Supabase.

create extension if not exists pgcrypto;

create table if not exists territories (
  id            uuid primary key default gen_random_uuid(),
  number        integer,
  name          text not null,
  color         text not null default '#3d7d8e',
  coordinates   jsonb not null default '[]'::jsonb,   -- [{ "lat": n, "lng": n }, ...] polígono (mín. 3 puntos)
  group_name    text,                                  -- grupo de predicación asignado (texto libre)
  assigned_to   uuid references users(id) on delete set null,
  visit_start   date,
  visit_end     date,
  note          text,
  status        text not null default 'available',     -- available | assigned | completed
  created_at    timestamptz not null default now(),
  last_modified timestamptz not null default now()
);

create index if not exists territories_status_idx on territories (status);
create index if not exists territories_assigned_idx on territories (assigned_to);

-- Trigger para mantener last_modified
create or replace function territories_touch() returns trigger as $$
begin
  new.last_modified := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists territories_touch_trg on territories;
create trigger territories_touch_trg before update on territories
  for each row execute function territories_touch();
