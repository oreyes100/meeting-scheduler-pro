---
name: boot
description: Inicializa sesión Meeting Scheduler Pro: carga invariantes, memoria, estado y Top Of Mind.
---

ROLE: Session Initializer — Meeting Scheduler Pro (Heartbeat Pattern)

SCOPE: Solo inicialización. No ejecutar tareas del usuario en este skill.

INPUTS: Ninguno requerido. Leer filesystem.

JIT CONTEXT LOADING (Just-In-Time — token efficiency):
- Boot carga SOLO: CLAUDE.md, CONTEXTO.md, learned-rules.md, Decision Journal.md.
- Boot NO carga: Wiki/, MOCs/, src/ completo, node_modules, .next, sql/.
- grep/find: aplicar exclusiones (node_modules, .next, .git, .vercel, *.db, *.pdf, *.zip, *.mp4).

CONTEXT:
- Stack: Next.js (App Router) + Supabase + Tailwind CSS + Vercel
- Estado: TanStack Query + Zustand
- BD: Supabase PostgreSQL (multi-tenant con RLS)
- Deploy: Vercel (rama main), dev puerto 3099

PROCEDURE (Heartbeat Pattern — ejecutar en orden):

1. **Confirmar identidad y rol**
   Leer CLAUDE.md → confirmar stack, restricciones, glosario. NO resumir.

2. **Leer estado de sesión anterior**
   Leer .claude/memory/CONTEXTO.md → extraer: qué se completó, decisiones, next actions.

3. **Leer reglas y memoria**
   - Leer .claude/memory/learned-rules.md → reglas aprendidas
   - Leer .claude/memory/corrections.jsonl si existe → correcciones recientes
   - Leer .claude/memory/Decision\ Journal.md → decisiones cerradas (no re-debatir)

4. **Verificar integridad del proyecto**
   Ejecutar: `npm run build 2>&1 | tail -3`
   - Si falla: reportar error exacto como primera prioridad ANTES de Top Of Mind.
   - Si pasa: continuar.

5. **Consultar vault de conocimiento si hay ambigüedad arquitectural**
   Solo si la tarea del usuario lo requiere:
   - Wiki/ y MOCs/ del proyecto
   - Meta/METHODOLOGIES_INDEX.md del vault global

6. **Presentar Top Of Mind (máx 3 items) + primer output propuesto**
   Formato:
   ```
   ## Sesión iniciada — [fecha]

   **Estado**: [una línea — build OK / build FAIL + error]

   **Top Of Mind**:
   1. [item 1 de CONTEXTO.md]
   2. [item 2]
   3. [item 3]

   **Pendiente de sesión anterior**: [next action #1 de CONTEXTO.md]

   ¿Continuamos con [next action #1] o tienes otra prioridad?
   ```

RULES:
- Leer ANTES de proponer cualquier cambio
- Si build falla: no proponer cambios al código hasta entender el error
- Si CONTEXTO.md no existe: crearlo con estado inicial antes de continuar
- No re-debatir decisiones marcadas como CERRADO en Decision Journal.md

TERMINATION: Parar tras presentar Top Of Mind y pregunta de confirmación. No resumir el stack. No explicar qué hiciste en el boot.
