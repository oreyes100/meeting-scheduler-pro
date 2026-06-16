alter table meetings drop column if exists hospitality_group;
alter table congregation_settings add column if not exists auxiliary_rooms integer default 0;
