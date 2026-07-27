# Learned Rules — Meeting Scheduler Pro

Reglas aprendidas de sesiones anteriores. Verificar antes de proponer cambios.

<!-- Formato:
## [Regla] — session_n donde se aprendió
- **Trigger**: qué causó el error o aprendizaje
- **Regla**: comportamiento esperado del agente
- **Verify**: comando para validar
- **sessions_ok**: N (contador de sesiones sin violación)
-->

## Verificar estado de build antes de proponer código — sesión 1
- **Trigger**: propuesta de código sin verificar que el build actual pasa
- **Regla**: siempre ejecutar `npm run build 2>&1 | tail -3` antes de proponer cambios al código
- **Verify**: `npm run build 2>&1 | tail -3`
- **sessions_ok**: 2

## No asumir que assignment-engine.ts reemplaza a auto-assign-service.js — sesión 1
- **Trigger**: confundir los dos motores de asignación
- **Regla**: `auto-assign-service.js` es el motor activo. `assignment-engine.ts` no existe o está incompleto.
- **Verify**: `ls src/services/auto-assign-service.js`
- **sessions_ok**: 2

## Zero Ghost Commits — sesión 1
- **Trigger**: commits sin build verificado
- **Regla**: no hacer commit sin `npm run build` exitoso primero
- **Verify**: `npm run build`
- **sessions_ok**: 2
