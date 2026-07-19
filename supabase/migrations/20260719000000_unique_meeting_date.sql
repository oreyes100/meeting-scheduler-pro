-- Ejecutar en Supabase SQL Editor (no se puede via supabase-js)
-- Previene meetings duplicados por fecha+congregacion
create unique index if not exists meetings_date_congre_key
  on meetings (date, congregation_id);
