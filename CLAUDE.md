@AGENTS.md

# CLAUDE.md — Meeting Scheduler Pro

## Rol del Agente
Co-desarrollador. Implementa features, corrige bugs, refactoriza. No toma decisiones de UX sin confirmación.

## Stack Técnico
- **Framework**: Next.js (App Router) — leer `node_modules/next/dist/docs/` ante APIs dudosas
- **BD**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Estilos**: Tailwind CSS
- **Lenguaje**: TypeScript (src/) + JavaScript (scripts/, servicios legacy)
- **Deploy**: Vercel

## Contexto del Proyecto
Planificador de reuniones de congregación Testigos de Jehová (Vida y Ministerio Cristianos). Reemplaza "New World Scheduler". Gestiona asignación de partes semanales a publicadores con auto-asignación por disponibilidad.

## Arquitectura Clave
```
src/
  app/api/          ← Route Handlers Next.js (meetings, persons, users)
  components/       ← MeetingDashboard, MeetingOverview, PrintModal, Sidebar
  lib/
    programs.ts     ← PROGRAMS[monday] — catálogo de partes semanales (hardcoded, SSOT)
    supabase.ts     ← cliente Supabase
  services/
    assignment-engine.ts    ← TypeScript, lógica de asignación (nuevo)
    auto-assign-service.js  ← JavaScript legacy, usar engine.ts para código nuevo
  types/index.ts    ← Person, MeetingPart, Program, PartType, etc.
```

## Tablas Supabase Principales
- `meetings` — una fila por semana; campos: date, chairman_id, songs, cbs_conductor_id, cbs_reader_id
- `meeting_parts` — partes individuales con assigned_user_id
- `persons` — publicadores con flags de capacidad (can_be_chairman, can_do_gems, etc.)

## Restricciones Permanentes
- **No commitear sin confirmación explícita.**
- **No crear archivos .md** salvo que el usuario los pida.
- **No agregar features** más allá de lo pedido.
- **No manejar errores** para escenarios imposibles — solo validar en boundaries reales.
- **No tocar** `src/lib/programs.ts` para agregar semanas sin confirmación (cambio manual deliberado).
- Si tarea afecta **>3 archivos** → exponer plan antes de editar.
- Antes de acción destructiva (reset, drop, rm): confirmar con usuario.
- **`git push` a producción: ejecutar sin preguntar** — el usuario ya hizo pruebas antes de pedir el push.
- **Congregación**: "La Estación" (constante en PrintModal.tsx → `CONGREGATION_NAME`).

## Formato de Output
- Respuestas concisas. Sin intro genérica.
- Sin summary al final.
- Código: siempre con path del archivo. Sin comentarios obvios.
- Errores: citar exacto el mensaje, no parafrasear.

## Comandos de Referencia
- `npm run dev` — servidor local en puerto 3000
- `node seed_test_users.js` — poblar BD con usuarios de prueba
- `node createTestMeeting.js` — crear reunión de prueba
