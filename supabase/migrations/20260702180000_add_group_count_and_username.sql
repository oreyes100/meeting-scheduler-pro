alter table congregation_settings add column if not exists field_service_group_count integer default 4;
alter table users add column if not exists username text;
create unique index if not exists idx_users_username on users(username) where username is not null;
