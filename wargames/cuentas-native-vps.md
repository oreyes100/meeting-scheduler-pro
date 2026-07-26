# War-game: Cuentas nativo en VPS — auth unificado por congregación
> Executor: ejecuta los movimientos en orden. Antes de cada movimiento lee sus señales de fallo. Verifica las condiciones de aborto después de cada movimiento.

---

## Objetivo de la misión
Reemplazar el módulo Cuentas actual (iframe hacia `cuentas-congregacion-bay.vercel.app` con login propio) por una implementación nativa dentro de MSP. Al terminar:
- Las cuentas viven en la misma SQLite del VPS (`data/msp.db`) bajo la tabla `cuentas_transactions`.
- El acceso usa la sesión MSP existente (`getSessionContext()` → `congreId`). No existe login separado.
- Un usuario de congregación "Universidad Tiripetio" no puede leer ni escribir transacciones de "La Estación" (aislamiento por `congregation_id`).
- Los archivos eliminados son: `src/app/cuentas/page.tsx` (iframe) y `src/app/api/cuentas-admin/route.ts` (proxy externo).
- El build pasa (`npm run build`) sin warnings de TypeScript.

---

## Resumen de recon

### Stack
- **Framework**: Next.js App Router, TypeScript, Tailwind CSS
- **BD**: SQLite vía `better-sqlite3`. Acceso centralizado en `src/lib/sqlite.ts → getDb()`
- **Auth**: JWT (`msp_session` cookie, `HS256`, 7 días) verificado en `src/lib/serverContext.ts → getSessionContext()`. Devuelve `{ userId, congreId, isSuperAdmin, email }`.
- **Multi-tenant**: todas las tablas llevan `congregation_id TEXT REFERENCES congregations(id)`. Cada route handler filtra por `ctx.congreId`.
- **Schema**: definido en `src/lib/schema.sql` (idempotente con `CREATE TABLE IF NOT EXISTS`). Migraciones en caliente en `sqlite.ts` con `try/catch` (columna ya existe = ignorar).
- **Deploy**: VPS, sin Vercel. `git push` a producción sin confirmación (regla CLAUDE.md).

### Estado actual de Cuentas
| Archivo | Rol actual | Destino |
|---|---|---|
| `src/app/cuentas/page.tsx` | Muestra iframe a `cuentas-congregacion-bay.vercel.app` | Reemplazar con UI nativa |
| `src/app/api/cuentas-admin/route.ts` | Proxy con `CUENTAS_MASTER_SECRET` para gestionar users en app externa | Eliminar |
| `NEXT_PUBLIC_CUENTAS_URL` en env | URL del iframe | Retirar |
| `CUENTAS_INTERNAL_URL` / `CUENTAS_MASTER_SECRET` en env | Proxy interno | Retirar |

### Módulo en `modules.ts`
```ts
{ key: 'cuentas', path: '/cuentas', title: 'Cuentas', description: 'Contabilidad de la congregación (S-26, S-30)', Icon: Banknote }
```
El módulo ya existe. Solo cambia la página que lo implementa.

### Modelo de datos S-26 / S-30 (JW)
- **S-26** = transacción individual (ingreso o egreso): fecha, categoría, descripción, monto, comprobante.
- **S-30** = balance mensual: resumen de ingresos/egresos/saldo por mes y congregación.
El S-30 se puede derivar automáticamente de las transacciones S-26 (no requiere tabla separada si se computa al vuelo).

### Regla de >3 archivos
Esta misión toca: schema.sql, sqlite.ts (migración), nueva API route, nueva página, y elimina 2 archivos. Total = 5+ archivos → el executor debe exponer el plan antes de editar (invariante CLAUDE.md). Este war-game actúa como ese plan.

---

## Movimientos

### Move 1: Agregar tablas `cuentas_transactions` y `cuentas_categories` al schema

**Action:**
Añadir al final de `src/lib/schema.sql`:

```sql
-- ─── 33. CUENTAS — CATEGORÍAS (→ congregaciones) ─────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas_categories (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('income','expense')),
  sort_order      integer DEFAULT 0,
  congregation_id text REFERENCES congregations(id),
  UNIQUE(name, congregation_id)
);

-- ─── 34. CUENTAS — TRANSACCIONES S-26 (→ congregaciones) ─────────────────────
CREATE TABLE IF NOT EXISTS cuentas_transactions (
  id              text PRIMARY KEY,
  date            text NOT NULL,               -- YYYY-MM-DD
  type            text NOT NULL CHECK (type IN ('income','expense')),
  category_id     text REFERENCES cuentas_categories(id) ON DELETE SET NULL,
  description     text NOT NULL,
  amount          real NOT NULL CHECK (amount > 0),
  receipt_ref     text,                        -- número de comprobante / folio
  notes           text,
  created_by      text REFERENCES users(id) ON DELETE SET NULL,
  created_at      text DEFAULT (datetime('now')),
  updated_at      text DEFAULT (datetime('now')),
  congregation_id text REFERENCES congregations(id)
);

CREATE INDEX IF NOT EXISTS idx_cuentas_tx_date   ON cuentas_transactions(date, congregation_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_tx_type   ON cuentas_transactions(type, congregation_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_tx_congre ON cuentas_transactions(congregation_id);
```

También agregar en `sqlite.ts` dentro del bloque `runMigrations` (para DBs existentes que ya pasaron el schema inicial):
```ts
// No se puede hacer CREATE TABLE IF NOT EXISTS en runMigrations porque ese array
// usa ALTER TABLE. Para tablas nuevas, el schema.sql idempotente es suficiente —
// `getDb()` corre `db.exec(schema)` en cada arranque. No se necesita entrada extra.
```
→ En realidad no se necesita migración extra: `sqlite.ts` ejecuta `schema.sql` en cada arranque y las nuevas tablas se crean automáticamente si no existen.

**Expected observation if it worked:** `npm run build` pasa. Al arrancar el servidor, las tablas `cuentas_categories` y `cuentas_transactions` aparecen en `.tables` de la SQLite.

**Expected observation if it failed:** Build error de TypeScript en otro archivo que importa schema de forma inesperada. O la tabla no aparece porque `schema.sql` no se relee (¿proceso en caliente sin reinicio?).

**Most likely cause of failure:** El servidor de desarrollo está corriendo con la DB cargada en memoria (`_db` singleton). Las nuevas tablas solo se crean en el próximo arranque. En producción (PM2 restart) se aplican solos.

**Countermove:** Si hay que forzarlo en desarrollo: parar el servidor, borrar `_db` (variable en memoria se resetea al reiniciar), o agregar las tablas a `runMigrations` como:
```ts
`CREATE TABLE IF NOT EXISTS cuentas_categories (id text PRIMARY KEY, ...)`,
```
Esto es redundante con schema.sql pero seguro.

**Downstream consequences:** Move 2 depende de que estas tablas existan en runtime.

---

### Move 2: Crear `src/app/api/cuentas/route.ts` (CRUD de transacciones)

**Action:**
Crear el route handler con los métodos:
- `GET /api/cuentas?month=YYYY-MM` → lista transacciones del mes para `ctx.congreId`
- `POST /api/cuentas` → crea transacción (body: `{ date, type, category_id?, description, amount, receipt_ref?, notes }`)
- `DELETE /api/cuentas?id=<id>` → elimina solo si pertenece a `ctx.congreId`
- `PUT /api/cuentas` → actualiza si pertenece a `ctx.congreId`

Patrón del route (consistente con el resto del proyecto):
```ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import { randomUUID } from 'crypto';

export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.congreId) return NextResponse.json({ error: 'Sin congregación' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // YYYY-MM opcional

  const db = getDb();
  let rows;
  if (month) {
    rows = db.prepare(`
      SELECT t.*, c.name as category_name, c.type as category_type
      FROM cuentas_transactions t
      LEFT JOIN cuentas_categories c ON c.id = t.category_id
      WHERE t.congregation_id = ? AND strftime('%Y-%m', t.date) = ?
      ORDER BY t.date DESC, t.created_at DESC
    `).all(ctx.congreId, month);
  } else {
    rows = db.prepare(`
      SELECT t.*, c.name as category_name
      FROM cuentas_transactions t
      LEFT JOIN cuentas_categories c ON c.id = t.category_id
      WHERE t.congregation_id = ?
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT 500
    `).all(ctx.congreId);
  }
  return NextResponse.json({ transactions: rows });
}
```
Aplicar misma lógica de `congregation_id` guard en POST/PUT/DELETE.

También crear `src/app/api/cuentas/categories/route.ts` para CRUD de categorías.

**Expected observation if it worked:** `GET /api/cuentas` devuelve `{ transactions: [] }` (vacío al inicio) con status 200. `POST` inserta y devuelve la fila creada.

**Expected observation if it failed:** 
- `500` con `no such table: cuentas_transactions` → Move 1 no completado o servidor no reiniciado.
- `401` → cookie no presente (problema de cliente, no del route).
- `403 Sin congregación` → usuario sin `congregation_id` en DB.

**Most likely cause of failure:** Tabla no existente por singleton de DB en memoria (ver Move 1 countermove).

**Countermove:** Agregar `CREATE TABLE IF NOT EXISTS cuentas_transactions (...)` al array `runMigrations` de `sqlite.ts` como strings completos. Reiniciar servidor.

**Downstream consequences:** Move 3 (UI) depende de este endpoint. Si el endpoint devuelve error, la página muestra error pero no se rompe el build.

---

### Move 3: Reemplazar `src/app/cuentas/page.tsx` con UI nativa

**Action:**
Sobrescribir el archivo con una página React que:
1. Llama a `GET /api/cuentas?month=YYYY-MM` para el mes seleccionado.
2. Muestra tabla de transacciones: fecha, tipo (ingreso/egreso), categoría, descripción, monto.
3. Tiene botón "Nueva transacción" → modal/formulario con campos del Move 2.
4. Muestra totales del mes: total ingresos, total egresos, balance.
5. Selector de mes (anterior/siguiente) para navegar.
6. No necesita iframe, no necesita `NEXT_PUBLIC_CUENTAS_URL`.

La página usa el mismo patrón visual que el resto del proyecto (Tailwind, `IconSidebar`, `SyncStatus`).

**Expected observation if it worked:** La página `/cuentas` carga sin iframe, muestra tabla vacía o con datos según la DB, el formulario de nueva transacción funciona.

**Expected observation if it failed:**
- La página crashea con `TypeError: Cannot read properties of null` → el fetch devolvió error y no se validó el JSON.
- La UI se ve desalineada → clases Tailwind incorrectas (menor, no bloquea).
- `build` falla por type error en el nuevo componente.

**Most likely cause of failure:** Tipo de dato en la respuesta del API no coincide con el tipo TypeScript declarado en la página (campo `amount` como string vs number en SQLite).

**Countermove:** Verificar que `better-sqlite3` devuelve `amount` como `number` (lo hace por defecto para columnas `real`). Si hay mismatch, castear en el route: `amount: Number(row.amount)`.

**Downstream consequences:** Si este move falla en build, bloquea el push a producción.

---

### Move 4: Eliminar `src/app/api/cuentas-admin/route.ts`

**Action:**
Borrar el archivo. Verificar que nada en el codebase lo importa:
```bash
grep -r "cuentas-admin" src/ --include="*.ts" --include="*.tsx"
```
Si solo aparece en la propia route (0 referencias externas), eliminar.

**Expected observation if it worked:** El grep devuelve 0 líneas (o solo el propio archivo antes de borrarlo). `npm run build` pasa sin ese archivo.

**Expected observation if it failed:** `grep` encuentra referencias en `src/app/backend/page.tsx` o `src/app/super-admin/page.tsx` → hay UI que llama a ese endpoint.

**Most likely cause of failure:** La página `super-admin` o `backend` tiene un botón "Gestionar usuarios de Cuentas" que llama a `/api/cuentas-admin`.

**Countermove:** Buscar en ambas páginas:
```bash
grep -n "cuentas-admin\|cuentas_admin\|CuentasAdmin" src/app/backend/page.tsx src/app/super-admin/page.tsx
```
Si existen referencias, eliminarlas de la UI antes de borrar el route. Si la feature de gestionar usuarios externos ya no es necesaria (login eliminado), quitar también el botón de UI.

**Downstream consequences:** Las vars de entorno `CUENTAS_INTERNAL_URL` y `CUENTAS_MASTER_SECRET` quedan huérfanas. No son error, pero documentar su retiro en el próximo cierre de sesión.

---

### Move 5: Limpiar variables de entorno obsoletas

**Action:**
En `.env` y `.env.local` del VPS (no en el repo), identificar y comentar/eliminar:
```
CUENTAS_INTERNAL_URL=...
CUENTAS_MASTER_SECRET=...
NEXT_PUBLIC_CUENTAS_URL=...
```
Verificar que el build no falla sin ellas (los archivos que las usaban ya fueron eliminados).

**Expected observation if it worked:** `npm run build` pasa limpio. Los archivos `.env` quedan sin esas claves.

**Expected observation if it failed:** `build` falla con `ReferenceError` o TypeScript queja sobre `process.env.CUENTAS_*` → algún archivo no eliminado sigue referenciándolas.

**Most likely cause of failure:** La página `cuentas/page.tsx` original tenía `const CUENTAS_URL = process.env.NEXT_PUBLIC_CUENTAS_URL || '...'`. Si el archivo fue reemplazado correctamente en Move 3, esto ya no existe.

**Countermove:**
```bash
grep -r "CUENTAS" src/ --include="*.ts" --include="*.tsx"
```
Eliminar cualquier referencia residual.

**Downstream consequences:** Ninguno. Este move es cosmético/seguridad.

---

### Move 6: Verificación de aislamiento multi-congregación

**Action:**
Con dos usuarios de congregaciones distintas en la DB (o usando el super-admin para crear un segundo usuario de prueba), verificar manualmente:
1. Loguear como usuario de congregación A → crear una transacción → confirmar que se guarda con `congregation_id = A`.
2. Loguear como usuario de congregación B → `GET /api/cuentas` → verificar que la respuesta devuelve `[]` (no ve la transacción de A).
3. Intentar `DELETE /api/cuentas?id=<id-de-A>` como usuario B → debe devolver `404` (no encontrado bajo su `congreId`).

El DELETE correcto para aislamiento:
```ts
const deleted = db.prepare(
  `DELETE FROM cuentas_transactions WHERE id = ? AND congregation_id = ?`
).run(id, ctx.congreId);
if (deleted.changes === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
```

**Expected observation if it worked:** Usuario B ve lista vacía. El DELETE de registro ajeno devuelve 404.

**Expected observation if it failed:** Usuario B ve transacciones de A → el filtro `WHERE congregation_id = ?` falta en la query GET, o `ctx.congreId` es `null` y se omite el filtro.

**Most likely cause of failure:** El route GET no filtra cuando `congreId` es null (el guard `if (!ctx.congreId) return 403` debe ejecutarse ANTES de la query).

**Countermove:** Auditar el route line-by-line: el guard de `congreId` debe ser la primera validación después del guard de `userId`.

**Downstream consequences:** Si este movimiento falla, la misión no está completa — no hacer push a producción hasta que el aislamiento esté verificado.

---

### Move 7: Build final y push a producción

**Action:**
```bash
npm run build
# Si pasa:
git add -A
git status  # revisar que no hay archivos sensibles (env, credenciales)
git commit -m "feat(cuentas): módulo nativo VPS — elimina iframe y login externo"
git push
```

**Expected observation if it worked:** Build sin errores TypeScript ni warnings de página no encontrada. El push llega al VPS y PM2 (o equivalente) reinicia el proceso.

**Expected observation if it failed:** 
- Build falla con error de tipo → corregir antes de commitear.
- Push rechazado → verificar rama y remoto.
- Servidor no reinicia → PM2/systemd no detectó el cambio.

**Most likely cause of failure:** Error de TypeScript en `cuentas/page.tsx` por tipos del fetch (la respuesta es `any`). Solución: definir interface `CuentasTransaction` con los campos del schema y castear la respuesta.

**Countermove:** Si el build falla, NO hacer push. Corregir el error específico citado por tsc y volver a intentar.

**Downstream consequences:** El sistema queda sin acceso a `cuentas-congregacion-bay.vercel.app` para siempre — asegurarse de que los datos históricos estén exportados antes del push si el usuario los necesita.

---

## Supuestos — RESUELTOS (2026-07-26)

| Supuesto | Resolución |
|---|---|
| **Datos históricos en Vercel** | Sin migración requerida. Respaldo ya hecho por el usuario; los datos de Vercel no se usarán más. |
| **Permisos** | Admin (`app_role = 'admin'` o `'elder'`) O usuario con `'cuentas'` en su array `permissions`. El rol se asigna desde Privilegios. |
| **Categorías / Códigos CT** | Ya definidos en la app actual. Seeded en `cuentas_ct_codes` con los códigos estándar JW (S-26-S). Admin puede agregar más desde la UI. |
| **Reportes** | Vista en pantalla es suficiente por ahora. S-26 (ledger mensual) + S-30 (resumen de balances). Export PDF/Excel es mejora futura. |

## Modelo de datos definitivo

La app Vercel usa **3 cuentas** y **3 tipos de transacción**:

- `account`: `recibido` | `principal` | `secundaria`
- `type`: `entrada` | `salida` | `transferencia`
- `destination_account`: solo para transferencias (cuenta destino)
- `ct_code`: texto libre referenciando un `cuentas_ct_codes.code`

Códigos CT estándar S-26-S (semilla):
```
R1: Donaciones para la obra de la congregación
R2: Donaciones para la obra mundial
R3: Donaciones para el Salón del Reino
R4: Donaciones para gastos del circuito
R5: Otras donaciones
G1: Gastos de la congregación
G2: Contribución a la obra mundial (sucursal)
G3: Gastos del Salón del Reino (renta/servicios)
G4: Gastos del circuito
G5: Otros gastos
T1: Transferencia entre cuentas
```

---

## Condiciones de aborto

1. **Move 1 falla en `npm run build`**: detener. El schema sql tiene un error de sintaxis. No continuar sin build limpio.
2. **Move 6 muestra que usuario B ve datos de usuario A**: detener antes del push (Move 7). Hay un fallo de aislamiento crítico de seguridad. Corregir el filtro y re-verificar.
3. **Los supuestos de datos históricos no están resueltos** y el usuario confirma que hay transacciones reales en la app de Vercel: pausar antes de Move 4 (eliminar cuentas-admin) hasta exportar los datos.
4. **El usuario no ha confirmado el alcance de permisos** y hay incertidumbre sobre si publicadores deben ver las cuentas: pausar antes de Move 3 y preguntar.
5. **`npm run build` falla en Move 7** después de todas las correcciones: no hacer `git push`. Reportar el error exacto de TypeScript.
