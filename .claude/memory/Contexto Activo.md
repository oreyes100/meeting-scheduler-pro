# Contexto Activo — Meeting Scheduler Pro / Sesión actual

## Estado del Proyecto
- **Versión**: 0.x (en desarrollo activo)
- **Sprint activo**: NINGUNO
- **Deploy**: Vercel (producción), rama `main`

## Última Sesión (2026-07-01)
### Completado
- **Módulo nuevo: Informes de Predicación** (gap real vs NWS Desktop, per `BLUEPRINT_NWS_TO_MSP_MIGRATION.md`):
  - Migración `20260701100000_add_field_service_reports.sql` — tabla `field_service_reports` (user_id→users, month, participated, is_auxiliary_pioneer, hours, bible_studies, notes; unique user_id+month). **PENDIENTE aplicar en Supabase.**
  - API `/api/field-service-reports` (GET mes/historial, POST upsert) + `[id]` (PUT/DELETE)
  - Página `/field-service-reports`: captura mensual con autosave, totales S-1 por categoría, panel S-21 por publicador (año de servicio sep–ago), impresión mes + registro individual
  - IconSidebar: entrada nueva (FileText); fix check `active` (exact match, evita doble highlight con /field-service)
- **Leaflet dark tiles** (pendiente #2 resuelto): CartoDB Dark Matter en dark mode, cambio en vivo vía `useTheme` en TerritoryMap
- **Fix search** (pendiente #3 resuelto): el API persons ya cubría display_name; el hueco real era PublicSpeakerModal → búsqueda sin acentos (`deaccent`) sobre display_name+first+last y congregación
- **Barrido dark-mode**: variantes `dark:` añadidas en territories (15 líneas), persons, meetings, login/cleaning/co-visit/tasks revisados (botones sobre gradiente se dejaron bg-white a propósito)
- **Protocolo `/close`** añadido a CLAUDE.md (cierre de Persistent Context)
- **Verificación**: `tsc --noEmit` limpio + `next build` 45/45 páginas OK (con env dummy; el fallo sin env es solo supabaseUrl del prerender de /login)

## Sesión Anterior (2026-06-15)
### Completado
- **Dark mode completo** — 4 commits aplicados a producción:
  - `67fc4d9` WeekendDashboard + MeetingDashboard: todas las clases `bg-white/gray-*` con `dark:`
  - `f34281b` Sidebar, territories, persons, congregation, modales — dark mode sistemático
  - `9ce8f8a` SELECT dropdowns con colores hardcoded (`#b4d5eb`, `#fdfad4`) → dark equivalents
  - `24fc03a` Icon sidebar `bg-sky-500` → `dark:bg-gray-900`
- **Verificación recursiva** con Chrome MCP + JS `getComputedStyle` en todas las páginas
  - `/meetings`, `/weekend`, `/persons`, `/congregation`, `/territories` — limpios
  - Única zona clara restante: tiles OpenStreetMap (Leaflet) — externos, no modificables

### Pendiente
- (nada bloqueante)

## Bugs Conocidos
1. **auto-assign 8/9**: CBS se asigna en `meetings.cbs_conductor_id` pero el conteo usa `meeting_parts.assigned_user_id` → contador visual puede confundir
2. ~~search=martinez devuelve 0~~ — RESUELTO 2026-07-01 (deaccent en PublicSpeakerModal; API persons ya cubría display_name)
3. ~~Mapa Leaflet claro en dark mode~~ — RESUELTO 2026-07-01 (CartoDB Dark Matter)

## Estado Técnico Actual
- `programs.ts` cubre semanas May 18 – Aug 17 2026 (hardcoded)
- `auto-assign-service.js` es el motor activo (no `assignment-engine.ts`)
- `cleaning_group` implementado en ambas tablas (entre semana + fin de semana)
- Territorios: Leaflet CDN, Supabase `territories` table, polígonos como jsonb
- PrintModal: S-140 + S-89 + Programa combinado (3 col) — paleta La Estación
- WeekendPrintModal: tarjetas (default) + tabla — toggle en toolbar
- Informes: `field_service_reports` (upsert user_id+month) — tabla `users` ES la tabla de publicadores

## Próximos Pasos — Prioridad
1. 🔴 Aplicar migración `20260701100000_add_field_service_reports.sql` en Supabase (SQL Editor o `apply_migration.js`)
2. 🟡 Agregar semanas `programs.ts` Aug 18+ cuando haya programa JW disponible
3. 🟡 Gaps NWS restantes (no priorizados esta sesión): motor de emails/recordatorios (8 categorías de plantillas), módulo Literatura, catálogo Songs.json

## Notas Arquitectónicas
- CSS variables semánticas en `globals.css` (`.dark { --color-surface: #1E293B ... }`)
- Dark mode: clase `.dark` en `<html>`, toggle via `ThemeProvider` → `localStorage`
- `bg-[#b4d5eb]` = SELECT asignado (azul claro); dark: `bg-[#1e3a4a]`
- `bg-[#fdfad4]` = SELECT estado alternativo (amarillo claro); dark: `bg-[#3a3a1a]`

---
*Actualizado: 2026-07-01*
