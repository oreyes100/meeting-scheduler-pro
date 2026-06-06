// setup-supabase.js
const { createClient } = require('@supabase/supabase-js');
// Load environment variables from .env and .env.local files
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function setupSupabase() {
  console.log('🔧 Iniciando configuración de Supabase...\n');
  
  console.log('⚠️  NOTA IMPORTANTE:');
  console.log('La biblioteca @supabase/supabase-js no permite ejecutar SQL directo ni crear tablas (no existe supabase.raw).');
  console.log('Para configurar tu base de datos, por favor sigue estos sencillos pasos:\n');
  
  console.log('1. Abre tu panel de control de Supabase: https://supabase.com/dashboard');
  console.log(`2. Selecciona tu proyecto (URL: ${supabaseUrl || 'https://hkenemrbaullpqklphsv.supabase.co'})`);
  console.log('3. Ve a la pestaña "SQL Editor" en el menú lateral izquierdo.');
  console.log('4. Haz clic en "New Query" (Nueva Consulta).');
  console.log('5. Copia y pega el siguiente código SQL y haz clic en "Run" (Ejecutar):\n');
  
  console.log('------------------ [ COPIAR DESDE AQUÍ ] ------------------');
  console.log(`
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
  `);
  console.log('------------------ [ HASTA AQUÍ ] ------------------\n');
  
  console.log('✅ El archivo .env.local ha sido actualizado con tu configuración actual de Supabase.');
}

setupSupabase();
