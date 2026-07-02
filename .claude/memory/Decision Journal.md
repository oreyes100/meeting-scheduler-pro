# Decision Journal — Meeting Scheduler Pro

Registro de decisiones arquitectónicas cerradas. No proponer alternativas a estas sin solicitud explícita del usuario.

---

## [2026-06-13] Motor de asignación: auto-assign-service.js es el motor activo

**Contexto**: Existen dos implementaciones de lógica de asignación:
- `src/services/auto-assign-service.js` — JavaScript legacy
- `src/services/assignment-engine.ts` — TypeScript, más reciente

**Decisión**: `auto-assign-service.js` es el motor real en producción. Todo código nuevo de asignación va aquí hasta migración explícita.

**Por qué**: `assignment-engine.ts` usa `Profile` (no `Person`), carece de LRA (Last Recent Assignment) y lógica de roles. Es código incompleto o experimento sin terminar.

**Alternativa descartada**: Migrar a `assignment-engine.ts` — descartada porque requeriría reimplementar LRA y roles sin ganancia funcional inmediata.

**Estado**: CERRADO. Reabrirse solo si el usuario pide migración TS explícitamente.

---

## [2026-06-13] programs.ts como SSOT hardcoded (no JSON externo)

**Contexto**: `src/lib/programs.ts` define el catálogo de partes semanales hardcoded. Alternativa evaluada: mover a JSON externo configurable.

**Decisión**: Mantener hardcoded en `programs.ts` por ahora. Cambio manual deliberado.

**Por qué**: Modificaciones requieren control explícito — no debe ser editable por accidente. El archivo es la única fuente de verdad y los cambios son poco frecuentes (por temporada del programa JW).

**Alternativa descartada**: JSON externo — descartada porque añade indirección sin beneficio real dado el volumen de cambios.

**Estado**: CERRADO. Reabrirse si el usuario pide explícitamente mover a JSON.

---

## [2026-06-15] Territorios: Leaflet vía CDN, no librería npm

**Contexto**: Módulo territorios (adaptado de TerritoryJW, repo React Native+Firestore). Necesita mapa con polígonos.

**Decisión**: Leaflet cargado por CDN (unpkg) imperativamente en `TerritoryMap.tsx`. Sin `react-leaflet` ni deps npm. OpenStreetMap como tiles (sin API key). Centro por defecto: Pátzcuaro [19.5126, -101.6093].

**Por qué**: Next 16 + React 19 → riesgo de peer-deps con react-leaflet. CDN evita conflictos de build y no requiere claves. Vercel tiene internet en runtime.

**Alternativa descartada**: react-leaflet / mapbox — peer-deps frágiles y/o API key de pago.

**Estado**: CERRADO. Tabla `territories` requiere correr `sql/territories_schema.sql` en Supabase (una vez).

---

## [2026-06-15] PrintModal: formato modelo "La Estación" hardcoded

**Contexto**: Usuario dio Word oficial como modelo exacto (colores teal/ámbar/marrón, viñetas, Limpieza/Hospitalidad amarillo).

**Decisión**: Paleta como constantes en `PrintModal.tsx` (TEAL/AMBER/MAROON/YELLOW). Misma paleta replicada en `WeekendPrintModal.tsx`. `CONGREGATION_NAME = 'La Estación'`.

**Pendiente conocido**: `cleaning_group`/`hospitality_group` no existen en tabla `meetings` — la fila Limpieza/Hospitalidad muestra `___` hasta agregar esos campos.

**Estado**: CERRADO (formato). Campos limpieza/hospitalidad = mejora futura.

---

## [2026-06-13] CBS: asignación en campo meeting-level, no en meeting_parts

**Contexto**: CBS conductor y lector se almacenan en `meetings.cbs_conductor_id` / `meetings.cbs_reader_id`, no como `meeting_parts.assigned_user_id`.

**Decisión**: Mantener esta estructura. La parte CBS en `meeting_parts` queda sin `assigned_user_id` por diseño.

**Por qué**: La UI divide CBS en 2 campos separados; la parte en `meeting_parts` es un placeholder estructural. El contador de auto-assign reporta 8/9 — comportamiento conocido, no bug.

**Estado**: CERRADO. Bug conocido documentado, no accionable sin cambio de esquema.

## [2026-07-01] Historial git: reconciliación del import zip via merge -s ours

**Contexto**: La copia local vino de un zip de GitHub (sin `.git`); el remoto tiene historial propio (main=4748c57).

**Decisión**: `git init` + commit del estado local completo (`ca17835`) + `merge -s ours origin/main` (`8c3f9d2`). El árbol local se conserva íntegro como fuente de verdad; el historial queda conectado y el push es fast-forward.

**Por qué**: `push --force` destruiría el historial remoto; rebase generaría conflictos masivos sin ganancia.

**Alternativa descartada**: force-push (destructivo); clonar el remoto y re-aplicar cambios a mano (propenso a error con 177 archivos).

**Estado**: CERRADO.

---

## [2026-07-01] Informes de Predicación: 3 pestañas S-1 sin nuevas tablas/endpoints

**Contexto**: NWS Desktop tiene el reporte "Predicación y Asistencia a las reuniones (S-1)" con 3 divisiones (Congregación, JW.org (S-1), Publicadores) y filtro por grupo en la pestaña Publicadores. MSP ya tenía una versión de una sola pestaña (sesión 3) sin filtro por grupo.

**Decisión**: Restructurar `field-service-reports/page.tsx` en 3 pestañas reutilizando el `totals` ya calculado (sin nueva query) para Congregación/JW.org, y consumiendo `/api/field-service-groups` (ya existía para otro módulo) para el filtro de la pestaña Publicadores. No se tocó schema ni se agregaron endpoints.

**Por qué**: El gap real era estructura de UI + un filtro faltante, no datos faltantes — `field_service_group_members` ya tenía todo lo necesario.

**Alternativa descartada**: Agregar columnas "Crédito"/"Tardío" y botón "Enviado a la sucursal" funcional para paridad visual completa con NWS — descartada porque no fueron pedidas explícitamente y requerirían nuevas columnas en `field_service_reports` (no inventar schema sin confirmación).

**Estado**: CERRADO (estructura). Commit pendiente de confirmación explícita.

---
