# Contexto Activo — Meeting Scheduler Pro / Sesión actual

## Estado del Proyecto
- **Versión**: 0.x (en desarrollo activo)
- **Sprint activo**: NINGUNO
- **Deploy**: Vercel (producido), rama `main`

## Última Sesión (2026-06-13)
### Completado
- Revisión de blueprints Obsidian vs estado del proyecto
- Expansión de CLAUDE.md con rol, restricciones, arquitectura real
- Creación de Contexto Activo
- Pruebas funcionales completas de todos los sistemas (ver Resultados abajo)

### Pendiente
- (nada bloqueante)

## Resultados de Pruebas Funcionales (2026-06-13)
| Sistema | Estado | Detalle |
|---------|--------|---------|
| Build | ✅ | `next build` limpio, 0 errores TS |
| TypeScript | ✅ | `tsc --noEmit` sin errores |
| GET /api/meetings | ✅ | 14 reuniones, migration_applied=true |
| GET /api/persons | ✅ | 91 personas (34M / 57F), migrationPending=false |
| GET /api/persons filters | ✅ | filter=elders(5), filter=brothers(34) correctos |
| POST /api/meetings | ✅ | Crea reunión, genera partes desde programs.ts |
| POST /api/meetings/[id]/assign | ✅ | Auto-asigna 8/9 partes (CBS sin parte CBS en partes — ver nota) |
| POST /api/meetings/[id]/clear | ✅ | Limpia asignaciones correctamente |
| POST /api/meetings/[id]/rebuild-parts | ✅ | Reconstruye partes preservando asignaciones |

### Observaciones / Bugs Potenciales
1. **auto-assign reporta 8/9**: El CBS (`cbs_conductor_id`/`cbs_reader_id`) se asigna en el campo meeting-level, pero el conteo final cuenta `meeting_parts.assigned_user_id`. La parte CBS en `meeting_parts` queda sin `assigned_user_id`. No es bug funcional pero el contador 8/9 puede confundir al usuario.
2. **assignment-engine.ts (TS)** está prácticamente sin usar — toda la lógica real va por `auto-assign-service.js`. El engine TS usa `Profile` (no `Person`) y su lógica es mucho más simple (sin LRA, sin roles). Código muerto o en progreso.
3. **node_modules incompleto en repo limpio** — `next` no estaba instalado, requirió `npm install`. Normal si .gitignore excluye node_modules, pero documentado.
4. **Reunión Sep 1 2026** creada en test usa FALLBACK_PROGRAM (songs 1,1,1) — semana fuera de rango de `programs.ts`.
5. **search=martinez devuelve 0** — posible bug: la búsqueda usa `ilike` en `last_name`, pero algunos registros pueden tener `last_name` null y nombre solo en `display_name` o `name`.

## Estado Técnico Actual
- `programs.ts` cubre semanas May 18 – Aug 17 2026 (hardcoded, se actualiza manualmente)
- `assignment-engine.ts` es código TS sin uso real — `auto-assign-service.js` es el motor activo
- `PrintModal.tsx` existe pero no fue auditado contra criterios print-first
- No hay tests automatizados
- BD: 14 reuniones existentes, 91 usuarios registrados

## Próximos Pasos — Prioridad
1. 🟡 Auditar `PrintModal.tsx` — alinear con principio print-first (IAS)
2. 🟢 Evaluar mover `PROGRAMS` a JSON externo para facilitar actualización sin código
3. 🟢 Agregar semanas Aug 18+ cuando el programa JW esté disponible

## Notas Arquitectónicas
- `auto-assign-service.js` depende de `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en env
- Roles de capacidad viven en `persons` (flags booleanos `can_*`)
- `meetings.cbs_conductor_id` / `cbs_reader_id` — CBS se almacena como una sola parte, UI lo divide en 2 campos

---
*Actualizado: 2026-06-13*
