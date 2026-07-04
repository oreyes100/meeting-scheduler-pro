create table if not exists congregation_roles (
  role_key text primary key,
  label text not null,
  person_id uuid references users(id) on delete set null,
  assistant_1_id uuid references users(id) on delete set null,
  assistant_2_id uuid references users(id) on delete set null,
  custom_label text,
  updated_at timestamptz default now()
);

insert into congregation_roles (role_key, label) values
  ('elders_coordinator', 'Coordinador del cuerpo de ancianos'),
  ('secretary', 'Secretario'),
  ('service_overseer', 'Superintendente de servicio'),
  ('midweek_overseer', 'Superintendente de la reunión Vida y Ministerio Cristiano'),
  ('auxiliary_counselor', 'Consejero auxiliar'),
  ('watchtower_conductor', 'Conductor de La Atalaya'),
  ('custom', 'Personalizado')
on conflict (role_key) do nothing;
