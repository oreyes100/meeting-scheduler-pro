-- Field Service Reports (informes mensuales de predicación por publicador)
-- Spec: NWS Desktop FieldServiceReports + S-21 (horas solo precursores)
create table if not exists field_service_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  month date not null, -- primer día del mes (YYYY-MM-01)
  participated boolean default false,
  is_auxiliary_pioneer boolean default false, -- precursor auxiliar ese mes
  hours numeric(5,1), -- solo precursores (regulares/especiales/auxiliares)
  bible_studies integer,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, month)
);

create index if not exists idx_fsr_month on field_service_reports(month);
create index if not exists idx_fsr_user on field_service_reports(user_id);
