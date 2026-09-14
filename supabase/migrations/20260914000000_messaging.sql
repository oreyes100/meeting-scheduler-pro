-- Mensajería (plataforma + WhatsApp) y Telegram.
-- Portado del esquema SQLite del VPS a Postgres/Supabase.

create table if not exists messaging_settings (
  congregation_id uuid primary key references congregations(id) on delete cascade,
  whatsapp_enabled integer not null default 0,
  provider text not null default 'cloud',
  phone_number_id text,
  access_token text,
  sender_label text,
  notify_on_assign integer not null default 1,
  notify_overdue integer not null default 1,
  overdue_days integer not null default 7,
  notify_weekly_status integer not null default 1,
  weekly_status_dow integer not null default 1,
  telegram_enabled integer not null default 0,
  telegram_bot_token text,
  telegram_chat_id text,
  telegram_notify_on_assign integer not null default 1,
  telegram_notify_overdue integer not null default 1,
  telegram_notify_weekly_status integer not null default 1,
  telegram_weekly_dow integer not null default 1,
  template_assign text,
  template_overdue text,
  template_weekly text,
  updated_at timestamptz default now()
);

create table if not exists messages (
  id text primary key,
  user_id uuid references users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  image_data text,
  territory_id uuid references territories(id) on delete cascade,
  read_at timestamptz,
  whatsapp_status text,
  whatsapp_error text,
  dedupe_key text,
  created_at timestamptz default now(),
  congregation_id uuid references congregations(id)
);

create index if not exists idx_msg_user on messages(user_id, read_at);
create index if not exists idx_msg_congre on messages(congregation_id);
create unique index if not exists idx_msg_dedupe on messages(dedupe_key) where dedupe_key is not null;
