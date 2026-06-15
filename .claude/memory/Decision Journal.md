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

## [2026-06-13] CBS: asignación en campo meeting-level, no en meeting_parts

**Contexto**: CBS conductor y lector se almacenan en `meetings.cbs_conductor_id` / `meetings.cbs_reader_id`, no como `meeting_parts.assigned_user_id`.

**Decisión**: Mantener esta estructura. La parte CBS en `meeting_parts` queda sin `assigned_user_id` por diseño.

**Por qué**: La UI divide CBS en 2 campos separados; la parte en `meeting_parts` es un placeholder estructural. El contador de auto-assign reporta 8/9 — comportamiento conocido, no bug.

**Estado**: CERRADO. Bug conocido documentado, no accionable sin cambio de esquema.
