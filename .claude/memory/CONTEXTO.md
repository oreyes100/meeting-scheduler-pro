# Contexto Activo — Meeting Scheduler Pro / Sesión 3

## Estado del Proyecto
- **Versión**: 0.x (en desarrollo activo)
- **Sesión**: 3 (bootstrap PMF completado)
- **Sprint activo**: NINGUNO
- **Deploy**: Vercel (producción), rama `main`

## Última Sesión (2026-06-24)
### Completado
- **Bootstrap PMF (Personal Memory Framework)**:
  - Wiki atómica creada (5 notas): Arquitectura-Supabase, Auto-Asignacion, Programs-Catalogo, Sesion-Semanal, Sync-Supabase
  - MOC-Meeting-Scheduler creado como punto de entrada temático
  - `.claude/agents/boot.md` y `close.md` — skills atómicos con JIT loading y checkpoint protocol
  - `.claude/memory/learned-rules.md` — reglas aprendidas de sesiones anteriores
  - `.claude/memory/corrections.jsonl` — registro de correcciones
  - `.claude/rules/verified-patterns.md` — patrones confirmados
  - `.claude/rtk-filter.json` — filtro de exclusión para búsquedas (node_modules, .next, .git)
  - CLAUDE.md actualizado con destinos canónicos, drivers activos y skills

### Pendiente
- (ninguno — bootstrap completado)

## Decisiones Técnicas (esta sesión)
| Decisión | Razón | Alternativa Desestimada |
|----------|-------|------------------------|
| CONTEXTO.md como nombre estándar (vs Contexto Activo.md) | Consistencia con Mis finanzas y metodología PMF | Contexto Activo.md (legacy) |
| agents/ (skills atómicos) en vez de solo commands/ | Mayor determinismo, scope y termination explícitos | Solo commands/ (menos estructural) |

## Bugs Conocidos
1. **auto-assign 8/9**: CBS se asigna en `meetings.cbs_conductor_id` pero el conteo usa `meeting_parts.assigned_user_id` → contador visual puede confundir
2. **search=martinez devuelve 0**: `ilike` en `last_name`, pero algunos registros tienen nombre en `display_name`
3. **Mapa Leaflet en dark mode**: tiles OSM son claros por diseño — para modo oscuro real se necesitaría cambiar tile provider (ej. CartoDB Dark Matter)

## Top Of Mind (para próxima sesión)
1. Agregar semanas `programs.ts` Aug 18+ cuando haya programa JW disponible
2. Leaflet dark tiles (CartoDB Dark Matter) — mejora cosmética
3. Fix search por `display_name` además de `last_name`

## Próximos Pasos — Prioridad
1. 🟡 Agregar semanas `programs.ts` Aug 18+
2. 🟢 Leaflet dark tiles
3. 🟢 Fix search display_name

---
*Cierre de sesión: 2026-06-24 | Bootstrap PMF completado*
