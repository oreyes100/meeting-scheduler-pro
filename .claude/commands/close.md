---
description: Cierre de sesión. Actualiza Contexto Activo y registra en sessions.jsonl.
---

1. Leer el historial completo de esta sesión.

2. Actualizar `.claude/memory/Contexto Activo.md`:
   - Mover tareas completadas hoy a "Última Sesión"
   - Actualizar "Pendiente" con lo que quedó sin terminar
   - Actualizar "Próximos Pasos — Prioridad" con la acción concreta siguiente
   - Actualizar la fecha al final del archivo
   - Preservar "Observaciones / Bugs Potenciales" — solo eliminar los cerrados explícitamente en esta sesión

3. Registrar en `.claude/memory/sessions.jsonl` (append, una línea JSON):
   ```json
   {"date":"YYYY-MM-DD","session_n":N,"summary":"[1 línea: qué se hizo]","score":X}
   ```
   - `score` 1-10: 10 = tarea completada + sin bugs introducidos, 5 = avance parcial, 1 = solo exploración
   - Inferir `session_n` del número de líneas existentes en el archivo + 1

4. Confirmar: "Sesión cerrada. Contexto persistido en Contexto Activo.md"
