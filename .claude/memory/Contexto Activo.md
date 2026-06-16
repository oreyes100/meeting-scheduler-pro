# Contexto Activo — Meeting Scheduler Pro / Sesión actual

## Estado del Proyecto
- **Versión**: 0.x (en desarrollo activo)
- **Sprint activo**: NINGUNO
- **Deploy**: Vercel (producción), rama `main`

## Última Sesión (2026-06-15)
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
2. **search=martinez devuelve 0**: `ilike` en `last_name`, pero algunos registros tienen nombre en `display_name`
3. **Mapa Leaflet en dark mode**: tiles OSM son claros por diseño — para modo oscuro real se necesitaría cambiar tile provider (ej. CartoDB Dark Matter)

## Estado Técnico Actual
- `programs.ts` cubre semanas May 18 – Aug 17 2026 (hardcoded)
- `auto-assign-service.js` es el motor activo (no `assignment-engine.ts`)
- `cleaning_group` implementado en ambas tablas (entre semana + fin de semana)
- Territorios: Leaflet CDN, Supabase `territories` table, polígonos como jsonb
- PrintModal: S-140 + S-89 + Programa combinado (3 col) — paleta La Estación
- WeekendPrintModal: tarjetas (default) + tabla — toggle en toolbar

## Próximos Pasos — Prioridad
1. 🟡 Agregar semanas `programs.ts` Aug 18+ cuando haya programa JW disponible
2. 🟢 Leaflet dark tiles (CartoDB Dark Matter) — mejora cosmética
3. 🟢 Fix search por `display_name` además de `last_name`

## Notas Arquitectónicas
- CSS variables semánticas en `globals.css` (`.dark { --color-surface: #1E293B ... }`)
- Dark mode: clase `.dark` en `<html>`, toggle via `ThemeProvider` → `localStorage`
- `bg-[#b4d5eb]` = SELECT asignado (azul claro); dark: `bg-[#1e3a4a]`
- `bg-[#fdfad4]` = SELECT estado alternativo (amarillo claro); dark: `bg-[#3a3a1a]`

---
*Actualizado: 2026-06-15*
