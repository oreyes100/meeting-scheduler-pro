-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  available_start TIME NOT NULL DEFAULT '08:00',
  available_end TIME NOT NULL DEFAULT '18:00'
);

-- 3. Crear tabla de reuniones (meetings)
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_by UUID REFERENCES users(id)
);

-- 4. Crear tabla de partes de la reunión (meeting_parts)
CREATE TABLE IF NOT EXISTS meeting_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('speaker', 'student')),
  assigned_user_id UUID REFERENCES users(id)
);

-- 5. Insertar usuario de ejemplo
INSERT INTO users (name, email, available_start, available_end)
VALUES ('Organizador Principal', 'organizador@ejemplo.com', '09:00', '17:00')
ON CONFLICT (email) DO NOTHING;