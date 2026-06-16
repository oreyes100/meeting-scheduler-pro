-- Grupo de limpieza manual por reunión (entre semana y fin de semana).
alter table meetings add column if not exists cleaning_group text;
alter table weekend_meetings add column if not exists cleaning_group text;
