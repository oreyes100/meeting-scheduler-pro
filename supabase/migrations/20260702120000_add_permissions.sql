-- Privilegios de uso por usuario (gating de módulos en la webapp)
alter table users add column if not exists app_role text default 'publisher'; -- 'admin' | 'elder' | 'publisher'
alter table users add column if not exists permissions jsonb default '[]';    -- lista de claves de módulo permitidas
alter table users add column if not exists auth_email text;                   -- vincula con supabase auth por email
