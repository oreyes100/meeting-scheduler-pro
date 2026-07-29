# War-game: MSP S15 — Endurecimiento de seguridad (Fase 0 + Fase 1)
> Ejecutor: corre los moves en orden. Antes de cada move, lee sus señales de fallo. Revisa las condiciones de aborto después de cada move.

## Objetivo de la misión
Cerrar la exposición de seguridad activa de meeting-scheduler-pro (rama `vps-selfhosted`, desplegado en VPS `/opt/msp` vía PM2, cwd `/opt/msp`) sin romper producción. Estado final medible:
1. El servidor **rechaza arrancar** si `AUTH_SECRET` falta o mide < 32 chars; el VPS corre con un secreto rotado de 64 hex chars (no el default `change-this-in-production-min-32-chars!!`).
2. Existe `src/middleware.ts` que valida la cookie JWT en el edge para `/api/*` (excepto login/health/resolve-login); un endpoint nuevo que olvide `getSessionContext()` deja de ser público por omisión.
3. Las rutas de mutación críticas (auth, cuentas) validan el body con `zod` antes de tocar la DB.
4. `xlsx@0.18.5` (CVE prototype-pollution + ReDoS) eliminado o reemplazado; una sola librería de hojas de cálculo.
5. El password SSH del VPS rotado; ningún secreto de texto plano queda en el árbol de trabajo (`deploy-now.sh` borrado).
6. `npm run build` limpio y `curl https://congregaciontj.duckdns.org/api/health` → `{"ok":true}` tras cada cambio desplegado.

Criterio de éxito global: los 6 puntos anteriores verificables + PDF sigue generándose (regresión previa ya resuelta) + login `oreyes100@gmail.com` sigue funcionando.

## Recon summary (hechos establecidos, verificados 2026-07-29)
- **AUTH_SECRET**: `src/lib/auth.ts:3` → `process.env.AUTH_SECRET || 'change-this-in-production-min-32-chars!!'`. El VPS `ecosystem.config.cjs` contiene **exactamente ese default**. Cualquiera que conozca la cadena (está en el repo público `oreyes100/meeting-scheduler-pro`) puede forjar una cookie de sesión válida. **Explotable HOY.** El JWT usa `jose` (HS256, `new TextEncoder().encode(SECRET)`).
- **middleware**: no existe `src/middleware.ts` ni `middleware.ts`. 81 archivos `route.ts`. 109 llamadas a `unauthenticated()`. Auth es opt-in por ruta. Rutas sin `getSessionContext`: `migrate` (410, seguro), `migrate-congregation` (GET filtra un `.sql` de esquema — fuga menor), `migrate-weekend`, `resolve-login`, `health`, `auth/login`, `auth/logout`, `cuentas/telegram`, `cuentas/ocr/internal`.
- **Patrón guard ya existe**: `src/app/api/cuentas/_guard.ts` exporta `requireCuentas()` → `{ ok, congreId, userId } | { ok:false, res }`, más `badRequest()` y `serverError()`. Solo ~10 rutas de cuentas lo usan. Es el molde para el wrapper `withAuth` de la propuesta #9.
- **serverContext**: `src/lib/serverContext.ts` exporta `getSessionContext(): Promise<SessionContext>`, `unauthenticated()`, `canAccessCuentas(ctx)`. `getSessionContext()` devuelve `congreId: null` si la query falla → sin filtro → riesgo de fuga cross-congregación.
- **zod**: no instalado. Validación ad-hoc (regex + typeof).
- **xlsx**: `package.json` tiene `xlsx@^0.18.5` **y** `xlsx-js-style@^1.2.0` (funcionalidad duplicada). `xlsx` sin fix de npm disponible para los CVE.
- **jest**: instalado (`jest@^30`, `@types/jest`) pero sin config, sin `__tests__/`, sin script `test`. Propuesta #7 sugiere migrar a vitest.
- **deploy-now.sh**: contiene el password SSH en texto plano. **NO está trackeado en git** (`git ls-files` vacío, no aparece en historial, `git log -S 'uljTQZj'` vacío). Existe solo en el working tree. El password real vive en GitHub Secrets (`VPS_SSH_KEY`, y `fix-vps.yml` usa `secrets.VPS_SSH_PASSWORD` — ninguno hardcodeado en YAML).
- **SSH password actual**: `uljTQZj_MKCuayAQ` — fue tecleado en el chat de esta sesión y está en `deploy-now.sh`. Debe rotarse porque quedó expuesto en logs de conversación, aunque no en git.
- **Deploy pipeline**: push a `vps-selfhosted` → GitHub Actions (`deploy-vps.yml`) → SSH puerto 22211 → `/opt/deploy-msp.sh` → clone + `npm ci` + `npm run build` en VPS + swap + `pm2 delete/start`. Ya funcional.
- **Auth key auth funciona**: `.claude/ssh/cowork_ed25519` instalada en `authorized_keys` del VPS; permite SSH sin password. Los deploys de CI ya no dependen del password.
- **Stack**: Next.js 16.2.6 + React 19 + Turbopack, sql.js/better-sqlite3 local en `/opt/msp/data/msp.db`. `package.json` tiene `"type":"module"` → scripts Node deben ser `.cjs`.

## Análisis de viabilidad (resumen para el humano, no parte de la ejecución)
| Propuesta | Viable | Necesaria | En este wargame |
|---|---|---|---|
| #1 AUTH_SECRET fail-fast + rotar | Sí, ~15 líneas | **Crítica — explotable hoy** | Move 1 |
| #2 Rotar SSH + borrar deploy-now.sh | Sí | Alta (expuesto en chat/disco; NO en git) | Move 2 |
| #3 middleware edge auth | Sí, patrón conocido | Alta | Moves 3-4 |
| #4 zod en auth+cuentas | Sí | Media-alta | Move 5 |
| #6 xlsx CVE | Sí, xlsx-js-style ya cubre | Media | Move 6 |
| #9 withAuth wrapper | Sí, _guard.ts es el molde | Media (refactor) | Move 4 (parcial) |
| #5 migration runner | Sí pero invasivo | Media | **Fuera** — wargame propio |
| #7 tests PDF/contabilidad | Sí | Alta a plazo | **Fuera** — wargame propio |
| #8 tipos desde schema | Sí | Baja urgencia | Fuera |
| #10 borrar dead code/dupes | Sí | Baja | Fuera |
| #11 consolidar scripts | Sí | Baja | Fuera |
| #12 docs | Sí | Baja | Fuera |
| #13 typecheck/CI | Sí | Media | Fuera (se toca en Move 7) |
| #14 política upgrade | Política, no código | Baja | Fuera |
| #15 varios menores | Sí | Baja | Fuera (localhost fallback se nota en Move 1) |

Veredicto: **viable y necesario**. Fase 0 (#1-#3) es exposición activa y cada cambio es acotado. Fase 1 (#4, #6, #9) previene la próxima falla. Fases 2-4 son mejoras de mantenibilidad → merecen wargames separados para no mezclar cambios de seguridad con refactors grandes en el mismo despliegue.

## Moves

### Move 1: AUTH_SECRET fail-fast + rotar el secreto de producción
- **Action:**
  1. Editar `src/lib/auth.ts`. Reemplazar la línea 3 por una carga estricta:
     ```typescript
     const rawSecret = process.env.AUTH_SECRET;
     if (!rawSecret || rawSecret.length < 32) {
       throw new Error('AUTH_SECRET ausente o < 32 chars. Configúralo en el entorno; no hay default.');
     }
     const SECRET = new TextEncoder().encode(rawSecret);
     ```
     Nota: `auth.ts` se importa en el arranque del servidor y en middleware; el throw en top-level module scope aborta el boot, que es lo deseado.
  2. Generar secreto nuevo: `openssl rand -hex 32` (64 chars hex).
  3. En el VPS, editar `/opt/msp/ecosystem.config.cjs`: sustituir `AUTH_SECRET: "change-this-in-production-min-32-chars!!"` por el secreto nuevo. Guardar el secreto también donde se guarden los demás (ej. gestor de secretos del usuario), NO en git.
  4. `npm run build` local para confirmar que el throw no rompe el build (Next evalúa módulos en build para prerender).
- **Expected observation si funcionó:** build local termina sin error (`AUTH_SECRET` sí está en `.env.local`); tras desplegar y reiniciar PM2 con el secreto nuevo, `pm2 list` muestra `online` y `curl .../api/health` → `{"ok":true}`. Las cookies de sesión viejas quedan invalidadas (firmadas con el secreto viejo) → hay que volver a hacer login. Un intento de forjar cookie con el default viejo → 401.
- **Expected observation si falló:** PM2 en estado `errored`/`stopped` con reinicios crecientes; `pm2 logs` muestra `AUTH_SECRET ausente o < 32 chars`. O el build local falla con el mismo throw (significa que `.env.local` no cargó).
- **Most likely cause of failure:** (a) el secreto no llegó a `ecosystem.config.cjs` porque PM2 necesita `delete`+`start` (no solo `restart`) para releer env; (b) build local falla porque Next no inyecta `.env.local` en el contexto de un módulo evaluado en build — en ese caso el prerender de rutas que importan `auth.ts` truena.
- **Countermove:** (a) usar `pm2 delete meeting-scheduler-pro && pm2 start /opt/msp/ecosystem.config.cjs` (ya es lo que hace `/opt/deploy-msp.sh`). (b) Si el build truena por prerender: mover el throw a lazy — envolver en una función `getSecret()` que se llame en runtime (dentro de `signToken`/`verifyToken`) en vez de top-level, conservando el fail-fast en la primera petición real. Verificar que ninguna ruta que importe `auth.ts` sea `export const dynamic = 'force-static'`.
- **Downstream consequences:** invalida TODAS las sesiones activas (incluida la del operador). Move 3 (middleware) también usará `verifyToken` → debe importar el mismo `auth.ts` endurecido; si Move 1 se hizo lazy, el middleware hereda el lazy correctamente. Tras este move, re-login obligatorio antes de probar cualquier ruta autenticada en moves posteriores.

### Move 2: Rotar password SSH + borrar secretos del working tree
- **Action:**
  1. Confirmar que la key `.claude/ssh/cowork_ed25519` da acceso sin password (los deploys de CI ya la usan) para no perder acceso al rotar el password.
  2. En el VPS: `passwd` (interactivo) o `echo 'devops:NUEVO_PASSWORD' | sudo chpasswd` con un password fuerte generado (`openssl rand -base64 24`). **Esta acción la ejecuta el usuario** — cambiar credenciales del sistema está fuera del alcance del ejecutor automático.
  3. Actualizar el GitHub Secret `VPS_SSH_PASSWORD` (usado por `fix-vps.yml`) con el nuevo valor, o mejor: migrar `fix-vps.yml` a autenticación por key (`VPS_SSH_KEY`) igual que `deploy-vps.yml`, y eliminar el secret de password.
  4. Borrar `deploy-now.sh` del working tree: `git rm --cached deploy-now.sh 2>/dev/null; rm -f deploy-now.sh` (no está trackeado, así que basta `rm`). Añadir `deploy-now.sh` y `*.local.sh` a `.gitignore` por si acaso.
  5. Verificar que ningún otro archivo del árbol contiene el password viejo: `grep -rn 'uljTQZj' . --exclude-dir=node_modules --exclude-dir=.git`.
- **Expected observation si funcionó:** SSH con key sigue conectando; SSH con el password viejo → `Permission denied`; `grep` del password viejo → sin resultados fuera de node_modules; `deploy-now.sh` ya no existe.
- **Expected observation si falló:** perder acceso SSH por completo (si la key no estaba bien instalada antes de rotar el password); o el `grep` encuentra el password en otro script suelto.
- **Most likely cause of failure:** rotar el password ANTES de confirmar que la key funciona. O `fix-vps.yml` sigue apuntando al password viejo y su próximo run falla.
- **Countermove:** verificar la key ANTES (paso 1 es bloqueante). Si se pierde acceso: consola física del VPS o el proveedor. Para `fix-vps.yml`: convertir a key auth (copiar el bloque `with:` de `deploy-vps.yml`).
- **Downstream consequences:** el password viejo `uljTQZj_MKCuayAQ` sigue en el historial de este chat — no scrubeable, pero inútil tras la rotación. Ningún move posterior debe volver a teclear un password en claro; usar siempre la key.

### Move 3: Crear src/middleware.ts con verificación JWT en el edge
- **Action:**
  1. Crear `src/middleware.ts`:
     ```typescript
     import { NextRequest, NextResponse } from 'next/server';
     import { jwtVerify } from 'jose';

     const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET!);
     const PUBLIC = ['/api/auth/login', '/api/auth/logout', '/api/health', '/api/resolve-login'];

     export async function middleware(req: NextRequest) {
       const { pathname } = req.nextUrl;
       if (!pathname.startsWith('/api/')) return NextResponse.next();
       if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
       const token = req.cookies.get('session')?.value; // confirmar nombre real de la cookie
       if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
       try {
         await jwtVerify(token, SECRET);
         return NextResponse.next();
       } catch {
         return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
       }
     }

     export const config = { matcher: ['/api/:path*'] };
     ```
  2. **Confirmar el nombre real de la cookie** leyendo `src/lib/auth.ts` / `serverContext.ts` (buscar `cookies().get(...)` o el `Set-Cookie`). No asumir `'session'`.
  3. **Confirmar la lista PUBLIC real**: revisar qué rutas deben ser accesibles sin sesión. Candidatos verificados sin auth hoy: `auth/login`, `auth/logout`, `health`, `resolve-login`. OJO: `cuentas/ocr/internal` y `cuentas/telegram` no usan `getSessionContext` — decidir si son internas (deben protegerse por otro secreto) o públicas. Las rutas `migrate*` deberían quedar detrás del middleware (no son públicas legítimas).
  4. Verificar que el middleware corre en runtime edge: `jose` es edge-compatible (no usa `crypto` de Node). ✓
  5. `npm run build`.
- **Expected observation si funcionó:** build genera `ƒ Middleware` en el output. `curl /api/congregation` sin cookie → 401. `curl /api/congregation` con cookie válida (tras re-login del Move 1) → 200. `curl /api/health` sin cookie → 200 (sigue público).
- **Expected observation si falló:** todas las rutas API → 401 incluso con cookie válida (nombre de cookie equivocado, o `AUTH_SECRET` distinto entre middleware y auth.ts). O el login mismo se bloquea (login no está en PUBLIC → loop imposible de autenticar).
- **Most likely cause of failure:** nombre de cookie asumido incorrecto; o `SECRET` del middleware lee `AUTH_SECRET` con `!` y en edge la env var no está inyectada → verify siempre falla. O el matcher atrapa `/api/auth/login` porque el `startsWith` de PUBLIC no cubre bien el caso.
- **Countermove:** leer el nombre de cookie ANTES de escribir (paso 2 bloqueante). Probar localmente con `curl` contra `npm run dev` antes de desplegar. Si el login se bloquea: añadir explícitamente todas las rutas `auth/*` a PUBLIC. Si edge no ve la env: confirmar que `AUTH_SECRET` está en `ecosystem.config.cjs` env (Next standalone lo pasa al runtime; el middleware corre en el mismo proceso Node en `output: standalone`, no en un edge externo).
- **Downstream consequences:** el middleware es defensa en profundidad, NO reemplaza `getSessionContext()` por ruta (que resuelve user/role/congreId). Move 4 mantiene los guards por ruta. Si el nombre de cookie cambia en el futuro, hay que tocar dos lugares (middleware + auth.ts) — documentarlo.

### Move 4: Generalizar _guard.ts en withAuth() y envolver rutas
- **Action:**
  1. Crear `src/lib/api.ts` con HOFs basados en `_guard.ts`:
     ```typescript
     import { getSessionContext, unauthenticated } from '@/lib/serverContext';
     import { NextResponse } from 'next/server';
     import type { SessionContext } from '@/lib/serverContext';

     export function withAuth(handler: (ctx: SessionContext, req: Request) => Promise<Response>) {
       return async (req: Request) => {
         try {
           const ctx = await getSessionContext();
           if (!ctx.userId) return unauthenticated();
           return await handler(ctx, req);
         } catch (e) {
           return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
         }
       };
     }
     export function apiError(msg: string, status = 400) { return NextResponse.json({ error: msg }, { status }); }
     ```
  2. Migrar primero las 9 rutas SIN `try/catch` (throws sin manejar → 500 sin estructura). Luego, incrementalmente, las que repiten el boilerplate `if (!ctx.userId) return unauthenticated()`.
  3. NO migrar de golpe las 81 rutas — hacerlo en lotes verificables. Este move entrega `api.ts` + migración de las rutas sin try/catch. El resto es trabajo de seguimiento.
- **Expected observation si funcionó:** las rutas migradas devuelven JSON de error estructurado en vez de 500 crudo ante excepción; `npm run build` limpio; comportamiento de auth idéntico (401 sin sesión).
- **Expected observation si falló:** cambia el shape de respuesta que el frontend espera (ej. una ruta devolvía `{data}` directo y ahora `{error}` en un caso borde); TypeScript se queja del tipo del handler.
- **Most likely cause of failure:** rutas con firmas distintas (algunas reciben `{ params }` de Next dynamic routes) no encajan en la firma genérica `(ctx, req)`.
- **Countermove:** hacer `withAuth` variádico o crear una variante `withAuthParams` para rutas dinámicas (`[id]`). Migrar solo rutas de firma simple en este move; las dinámicas en un lote posterior.
- **Downstream consequences:** con middleware (Move 3) + withAuth (Move 4), un endpoint nuevo está protegido por dos capas. Reduce ~150 líneas de boilerplate a plazo. No bloquea otros moves.

### Move 5: Instalar zod y validar rutas de auth + cuentas
- **Action:**
  1. `npm install zod`.
  2. Definir schemas para las mutaciones críticas. Empezar por `auth/login` (identifier+password), `cuentas/transactions` (POST), `cuentas/config` (PUT). Ejemplo:
     ```typescript
     import { z } from 'zod';
     const LoginSchema = z.object({ identifier: z.string().min(1), password: z.string().min(1) });
     const parsed = LoginSchema.safeParse(await request.json());
     if (!parsed.success) return apiError('Datos inválidos', 400);
     ```
  3. Reemplazar la validación ad-hoc (regex/typeof) donde exista, sin cambiar la semántica actual (mismos mínimos: password ≥ 4 en cuentas master, etc.).
  4. `npm run build`.
- **Expected observation si funcionó:** login sigue funcionando con credenciales válidas; body malformado → 400 estructurado en vez de 500 o comportamiento indefinido; build limpio.
- **Expected observation si falló:** una ruta rechaza payloads que antes aceptaba (schema demasiado estricto) → el frontend rompe; o `zod` añade peso al bundle edge del middleware (no debería — zod no va en middleware).
- **Most likely cause of failure:** el schema no contempla campos opcionales que el frontend sí envía (ej. `role` opcional en create_user).
- **Countermove:** marcar campos opcionales con `.optional()`; probar cada ruta migrada con el payload real que envía el frontend (inspeccionar la llamada `fetch` en el cliente). Migrar ruta por ruta, no todas.
- **Downstream consequences:** independiente de otros moves; se puede intercalar. Sienta base para #8 (tipos) a futuro.

### Move 6: Eliminar xlsx@0.18.5, consolidar en xlsx-js-style
- **Action:**
  1. `grep -rn "from 'xlsx'\|require('xlsx')" src` para hallar los imports del `xlsx` vulnerable (distinguir de `xlsx-js-style`).
  2. `xlsx-js-style` es un superset drop-in de la API de `xlsx` (mismo `read`/`utils`/`writeFile` + estilos). Cambiar `import * as XLSX from 'xlsx'` por `import * as XLSX from 'xlsx-js-style'` en cada sitio.
  3. `npm uninstall xlsx`.
  4. `npm run build` + probar export/import de cuentas.
  5. `npm audit` para confirmar que desaparecen los CVE de `xlsx`.
- **Expected observation si funcionó:** `npm audit` ya no lista `xlsx`; export de reporte de cuentas genera .xlsx idéntico; import de .xlsx sigue parseando; build limpio.
- **Expected observation si falló:** una función usada estaba en `xlsx` pero no en `xlsx-js-style` (raro, es superset); o algún import quedó apuntando a `xlsx` y `npm uninstall` lo rompe.
- **Most likely cause of failure:** import residual de `xlsx` en un script suelto de raíz (los ~24 scripts .js/.cjs) que no está en `src/`.
- **Countermove:** `grep -rn "xlsx'" . --exclude-dir=node_modules` (todo el repo, no solo src). Actualizar o borrar scripts obsoletos que importen `xlsx`.
- **Downstream consequences:** reduce bundle y superficie de CVE. Independiente. Si algún script legacy lo usa y no se puede migrar ya, mantener `xlsx` pero anotar en el reporte para #10/#11.

### Move 7: Verificación integral + CI de typecheck
- **Action:**
  1. Añadir scripts a `package.json`: `"typecheck": "tsc --noEmit"`. (No añadir `"test"` aquí — los tests son wargame aparte, #7.)
  2. Correr `npm run typecheck` y `npm run lint` — arreglar lo que rompan los moves anteriores.
  3. `npm run build` final.
  4. Commit + push a `vps-selfhosted` → dispara `deploy-vps.yml`.
  5. Esperar el run de Actions (`gh run watch`). Verificar en producción, en este orden:
     - `curl .../api/health` → `{"ok":true}`
     - login con `oreyes100@gmail.com` (password real) → `{"ok":true}` + cookie
     - `curl -b cookie .../api/cuentas/forms?kind=s26&ym=2026-07` → PDF válido (no regresión del bug de plantillas)
     - `curl .../api/congregation` SIN cookie → 401 (middleware activo)
     - intento de cookie forjada con el secreto viejo → 401 (secreto rotado)
- **Expected observation si funcionó:** los 5 checks pasan; PM2 `online` sin reinicios; run de Actions verde.
- **Expected observation si falló:** cualquier check falla → identificar cuál move lo causó (health caído = arranque, probablemente Move 1 AUTH_SECRET no llegó; 401 en todo = Move 3 nombre de cookie; PDF roto = plantillas no copiadas por el deploy).
- **Most likely cause of failure:** el secreto nuevo quedó en el `ecosystem.config.cjs` del VPS pero el `/opt/deploy-msp.sh` NO lo sobrescribe (el script no toca AUTH_SECRET), así que un redeploy conserva el secreto correcto — bien. PERO si alguien regenera `ecosystem.config.cjs` desde el repo, vuelve el default. Confirmar que `ecosystem.config.cjs` NO está en git con el secreto (debe leer de env o estar gitignoreado).
- **Countermove:** si `ecosystem.config.cjs` está trackeado con el default, cambiarlo a `AUTH_SECRET: process.env.AUTH_SECRET` y proveer la env por otro medio (archivo `.env` en `/opt/msp` leído por PM2, gitignoreado). Verificar antes de cerrar.
- **Downstream consequences:** cierre de la misión. Si algo falla, revertir el move culpable (cada uno es un commit atómico) y redeploy.

## Unresolved assumptions
- **Nombre real de la cookie de sesión**: asumido `'session'` en Move 3. Debe leerse de `src/lib/auth.ts`/`serverContext.ts` antes de escribir el middleware. Si es otro (`msp_session`, `token`), el middleware bloquea todo.
- **`ecosystem.config.cjs` ¿está en git?**: si lo está con el secreto en claro, rotarlo en el archivo del VPS no basta — el repo lo re-expone. Verificar `git ls-files` sobre él y decidir estrategia de env (Move 7 countermove).
- **`.env.local` en el runner de CI**: el build de CI corre `npm run build` en el VPS; necesita `AUTH_SECRET` presente en el entorno del build o el fail-fast del Move 1 rompe el prerender. Confirmar que el build de CI tiene la env (o que el throw es lazy, no top-level).
- **Rutas internas `cuentas/ocr/internal` y `cuentas/telegram`**: sin auth hoy. ¿Son llamadas internas (cron/webhook) que necesitan un secreto propio, o deben ir tras el middleware? Decidir con el usuario antes de meterlas en PUBLIC o bloquearlas.
- **Password nuevo del VPS**: lo genera y aplica el usuario (Move 2 paso 2) — cambiar credenciales del sistema está fuera del alcance del ejecutor.

## Abort conditions
- **`/api/health` deja de responder `{"ok":true}` tras cualquier deploy** → abortar, revertir el último commit, `pm2 logs` para diagnosticar antes de seguir.
- **El login queda bloqueado** (no se puede obtener cookie válida ni con credenciales correctas) → abortar Move 3, revisar nombre de cookie / lista PUBLIC / paridad de AUTH_SECRET entre middleware y auth.ts.
- **Se pierde acceso SSH** tras rotar el password (Move 2) sin haber confirmado la key primero → detener, recuperar por consola del proveedor antes de continuar.
- **El build de CI falla por AUTH_SECRET ausente** → no forzar; resolver la env del runner (assumption #3) antes de re-desplegar.
- **Cualquier move requiere cambiar credenciales del sistema, borrar datos, o tocar algo fuera de `/opt/msp` y el repo** → parar y reportar al usuario; no improvisar.
