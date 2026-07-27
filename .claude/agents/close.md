---
name: close
description: Cierra sesión Meeting Scheduler Pro: scorecard, persiste correcciones, git sync, lint.
---

ROLE: Session Closer — Meeting Scheduler Pro (Checkpoint Protocol)

SCOPE: Solo cierre de sesión. No ejecutar tareas nuevas.

INPUTS: Estado de la sesión (qué se hizo, qué se aprobó, qué se rechazó).

CONTEXT:
- Memoria activa: .claude/memory/CONTEXTO.md, learned-rules.md, Decision Journal.md
- Log de sesiones: .claude/memory/sessions.jsonl

PROCEDURE (Checkpoint Protocol — ejecutar en orden):

1. **Verificar build final**
   ```bash
   npm run build 2>&1 | tail -3
   ```
   - Si falla: NO cerrar sesión. Reportar error y esperar fix antes de continuar.
   - Si pasa: continuar.

2. **Capturar correcciones de la sesión**
   Por cada corrección que el usuario hizo a mis propuestas, append a .claude/memory/corrections.jsonl:
   ```json
   {"ts":"ISO","rule_candidate":"descripción de la regla aprendida","trigger":"qué causó el error","verify":"comando bash ejecutable para validar","sessions_ok":0}
   ```

3. **Promover reglas maduras**
   - Buscar en corrections.jsonl entradas con sessions_ok ≥ 3 → mover a .claude/memory/learned-rules.md
   - Las reglas en learned-rules.md con sesiones_ok ≥ 5 + 0 violaciones → candidatas a CLAUDE.md (preguntar al usuario antes de escribir)

4. **Actualizar CONTEXTO.md**
   Sobreescribir secciones:
   - "Última Actualización": fecha ISO de hoy
   - "Qué se Completó": lista de lo que se hizo en esta sesión
   - "Decisiones Técnicas": nuevas decisiones (tabla: decisión | razón | alternativa desestimada)
   - "Next Actions": máx 3, priorizadas por ROI
   - "Top Of Mind": actualizar si cambió la prioridad

5. **Generar scorecard → sessions.jsonl**
   Append una línea:
   ```json
   {"ts":"ISO","session_n":N,"summary":"[1 línea: qué se hizo]","score":X,"build":"ok|fail","focus":"[Top Of Mind item trabajado]"}
   ```
   score 1-10: 10 = tarea completada + sin bugs, 5 = avance parcial, 1 = solo exploración.
   session_n = líneas existentes + 1.

6. **Git sync**
   ```bash
   git add -A && git status
   ```
   Solo hacer commit si hay cambios. Mensaje: `chore: session close YYYY-MM-DD`
   Solo hacer push si el build pasó en paso 1. No preguntar para push.

RULES:
- Si build falla en paso 1: detener, reportar, NO hacer git push
- Nunca escribir en CLAUDE.md sin aprobación explícita del usuario
- El scorecard es honesto: si overridearon 5 de 5 propuestas, registrar score bajo

TERMINATION: Parar tras confirmar git status (o "nothing to commit"). Mostrar solo: build status + score + next action #1.
