# War-game: Migración COMPLETA de Cuentas al VPS (nativo, multi-congregación)
> Executor: ejecuta los movimientos en orden. Antes de cada movimiento lee sus señales de fallo. Verifica las condiciones de aborto después de cada movimiento.

---

## Objetivo de la misión

Migrar **toda** la app `cuentas-congregacion-bay.vercel.app` a MSP nativo en el VPS, con paridad funcional de módulos y reportes, eliminando el login propio y ligando los datos a la congregación del usuario autenticado.

Estado final medible:
- `/cuentas` no contiene iframe ni referencia a Vercel.
- Un usuario de "Universidad Tiripetio" que consulte cualquier endpoint de cuentas obtiene **solo** filas con su `congregation_id`; nunca ve "La Estación".
- Módulos presentes: Hoja S-26, Informe S-30, Formularios oficiales (S-26/S-30/S-25c), Relación I/E, Análisis Contables, Códigos CT, Cierre de Mes, Arqueo de Caja, Saldo inicial editable.
- Año de servicio Sep→Ago con navegación por mes.
- `npx tsc --noEmit` sin errores.

**Fuera de alcance (decidido, no omisión):** OCR de recibos + Asistente IA (dependen de clave Google externa), Admin de Usuarios (lo reemplaza Privilegios de MSP), Sync/Respaldo a Vercel Blob (MSP ya tiene módulo Respaldar y Restaurar).

---

## Recon summary — spec extraído del bundle legacy (`/app.js?v=14`, 127 159 chars)

Este es el spec real, no inferido. Se obtuvo leyendo el bundle y el DOM de la app en producción.

### Enums internos (de los `<select>` del DOM — CRÍTICO, nombres contraintuitivos)

```
type    : 'income' | 'expense' | 'transfer'
account : 'caja'      → etiqueta "Recibido (Donaciones)"
          'corriente' → etiqueta "Cuenta Principal (Caja de dinero)"
          'sucursal'  → etiqueta "Cuenta Secundaria"
```
`caja` NO es la caja de efectivo: es la cuenta de donaciones recibidas. `corriente` es la caja de dinero. Respetar estos valores permite reimportar el CSV/BD del respaldo sin traducir.

### Superficie de API del legacy (todas las rutas encontradas en el bundle)

```
/api/config              /api/codes (+ /:id)        /api/accounts
/api/transactions (+/:id)/api/s26-data              /api/monthly-report
/api/forms/s26           /api/forms/s30             /api/forms/s30/pdf
/api/forms/s25c          /api/service-year-summary  /api/reconcile
/api/saldo-inicial       /api/cierre-mes            /api/sync-status /api/sync-now
/api/auth/*  /api/users/*  /api/admin/*             /api/upload-receipt /api/ai-chat /api/ai-status
```

### Códigos CT y su agrupación en reportes (extraído de la lógica de S-25c)

```js
// Obra mundial — INGRESOS
incomeByCode.filter(r => r.code === 'OM' || r.code === 'DO')
// Obra mundial — REMESAS (egresos a la sucursal)
expenseByCode.filter(r => r.code === 'SOM' || r.code === 'RE' || r.code === 'ROM')
```

Catálogo confirmado en uso (pantallas + bundle):

| Código | Significado | Tipo |
|---|---|---|
| `C`   | Donaciones para los gastos de la congregación | income |
| `OM`  | Donaciones para la obra mundial | income |
| `DO`  | Caja de contribuciones "Obra Mundial" | income |
| `DK`  | Contribuciones para Salones del Reino | income (reservado) |
| `OI`  | Otros ingresos | income |
| `D`   | Depósito a caja de efectivo | transfer |
| `OV`  | Orador visitante / discursante | expense |
| `SOM` | Remesa obra mundial a la sucursal | expense |
| `RE`  | Remesa | expense |
| `ROM` | Remesa obra mundial | expense |

`TO-62` aparece solo como texto de instrucción en el S-25c (Registro de traspaso de fondos), no es código de transacción.

### Modelo del ledger S-26 (de la captura de producción)

Grid de 10 columnas: `Fecha | Descripción | CT | Recibido[Entrada|Salida] | Cta Principal[Entrada|Salida] | Cta Secundaria[Entrada|Salida] | Saldo`

- Una fila `transfer` ocupa **dos** columnas a la vez: Salida en cuenta origen + Entrada en cuenta destino. Ej.: `D | Deposito a caja de efectivo | Recibido/Salida 1260 | Principal/Entrada 1260`.
- La columna `Saldo` es el **total acumulado de las tres cuentas**, por eso un `transfer` no la mueve.
- Primera fila del mes: `JULIO — SALDO INICIAL` con el total y un lápiz de edición.
- Última fila: `TOTALES DE TODAS LAS COLUMNAS`.

Verificación aritmética con los datos reales de la captura (Julio 2026):
```
saldo inicial 2511 → +550 (OM) = 3061 → +710 (C) = 3771
→ D 1260 (transfer) = 3771  ✓ (no cambia el total)
Totales: Recibido E 5420 / S 9427 · Principal E 9427 / S 700 · Secundaria 0/0
Saldos: Recibido 1925+5420-9427 = -2082 ✓ | Principal 586+9427-700 = 6874 ✓ | Secundaria 0
Total general = -2082 + 6874 + 0 = 4792 ✓
```
El saldo de `Recibido` puede ser **negativo** — es normal: es cuenta de paso. No agregar validación que lo impida.

### Estructura del S-30 (líneas exactas, de la captura y del renderer)

Campos del payload: `a, b, c, d, e, f, g, box_kingdom, h, i, j, k`

```
(a) FONDOS A COMIENZO DE MES
(b) RECIBIDO POR LA CONGREGACIÓN     → desglose por código (C, OM, …) + TOTAL RECIBIDO
(c) GASTOS DE LA CONGREGACIÓN        → desglose por código (OV, …) + TOTAL DE GASTOS
(d) SOBRANTE / DÉFICIT  [(b) − (c)]
(e) FONDOS A FIN DE MES [(a) + (d)]
(f) FONDOS RESERVADOS PARA PROPÓSITOS ESPECIALES
      · Contribuciones para Salones del Reino (DK) → box_kingdom
      · Otras reservas
(g) FONDOS DISPONIBLES  [(e) − (f)]
── PÁGINA 2 — CONCILIACIÓN
(h) TOTAL DE FONDOS A COMIENZO DE MES  (= a)
(i) RECIBIDO         (total ingresos del mes)
(j) DESEMBOLSOS      (total gastos del mes)
(k) TOTAL DE FONDOS A FIN DE MES [(h)+(i)−(j)]  → debe coincidir con (e)
Detalle de Cajas de Contribuciones: Obra Mundial (DO) · Salones del Reino (DK)
MOVIMIENTOS POR CUENTA: Cuenta | Saldo Anterior | Ingresos | Egresos | Saldo Actual
```

Comprobación con datos reales: b=5420, c=700, d=4720, a=2511, e=7231, k=2511+5420−700=7231 ✓

### Estructura del S-25c (auditoría trimestral)

- Trimestres del año de servicio: `1.º Sep-Oct-Nov`, `2.º Dic-Ene-Feb`, `3.º Mar-Abr-May`, `4.º Jun-Jul-Ago`.
- Bloques de texto fijos: Verificación de las donaciones (4 preguntas), Verificación de los desembolsos (6 preguntas), Verificación de la cuenta principal.
- Tabla "DATOS DEL SISTEMA PARA LA AUDITORÍA": `Mes | Recibido (Entrada) | Desembolsos | Donaciones OM | Remesas OM` + fila Total del trimestre.
- Línea de conciliación: `Fondos finales = Fondos iniciales + Ingresos − Gastos`.

### Otros módulos

- **Saldo inicial** (`/api/saldo-inicial`): por mes, por cuenta. S-30 (a) = posición (i) del informe del mes anterior.
- **Cierre de mes** (`/api/cierre-mes`): `POST {year, month, publishers}` → genera gastos de cierre automáticos (remesa OM). Pide número de publicadores en un wizard.
- **Arqueo de caja**: conteo de billetes y monedas por denominación, compara contra el saldo de `corriente`, permite registrar la diferencia como transacción.
- **Relación I/E** (`/api/service-year-summary`): gráfico ingresos vs egresos por mes del año de servicio.
- **Análisis Contables** (`/api/reconcile`): verificaciones de cuadre por mes.
- **Config** (`/api/config`): nombre de congregación, ciudad, estado (ESTACION / PATZCUARO / MICH) — MSP ya tiene name/city en `congregations`; falta `state`.

### Contexto MSP relevante

- `getSessionContext()` → `{ userId, congreId, isSuperAdmin, email }` (src/lib/serverContext.ts)
- `canAccessCuentas(ctx)` ya existe (sesión previa): superadmin ó `app_role` admin/elder ó `permissions` incluye `'cuentas'`
- `getDb()` ejecuta `schema.sql` en cada arranque → tablas nuevas se crean solas al reiniciar
- Trabajo previo de esta misión ya commiteado en `be6a044` (rama `vps-selfhosted`), **no empujado**. Ese commit tiene un modelo simplificado (`entrada/salida/transferencia`, `recibido/principal/secundaria`) que **debe reemplazarse** por los enums reales del legacy.

---

## Movimientos

### Move 1: Corregir el schema a los enums reales del legacy

- **Action:** En `src/lib/schema.sql`, reemplazar las tablas `cuentas_ct_codes` / `cuentas_transactions` del commit `be6a044` por:
  - `cuentas_codes(id, code, description, kind CHECK(income|expense|transfer), sort_order, congregation_id, UNIQUE(code, congregation_id))`
  - `cuentas_transactions(id, date, type CHECK(income|expense|transfer), account CHECK(caja|corriente|sucursal), to_account CHECK(...), code, description, amount>0, receipt_ref, notes, created_by, created_at, updated_at, congregation_id)`
  - `cuentas_saldo_inicial(congregation_id, ym, caja, corriente, sucursal, PRIMARY KEY(congregation_id, ym))`
  - `cuentas_config(congregation_id PRIMARY KEY, label, city, state)`
  - Índices por `(congregation_id, date)` y `(congregation_id, code)`.
- **Expected if worked:** `npx tsc --noEmit` limpio; al reiniciar, `.tables` lista las 4 tablas.
- **Expected if failed:** `SQLITE_ERROR: near "CHECK"` al arrancar → sintaxis del CHECK mal formada.
- **Most likely cause:** coma sobrante antes del `UNIQUE(...)` o `PRIMARY KEY(...)` compuesto.
- **Countermove:** Validar el SQL aislado con `sqlite3 :memory: < schema.sql` antes de arrancar Next.
- **Downstream:** Todos los movimientos siguientes dependen de estos nombres de columna. Si se cambian, cambian los 6 archivos siguientes.

### Move 2: Crear `src/lib/cuentas.ts` — toda la aritmética contable en un solo lugar

- **Action:** Módulo servidor con: constantes `ACCOUNTS`/`TYPES`/`DEFAULT_CODES`, grupos `OM_INCOME=['OM','DO']` y `OM_REMIT=['SOM','RE','ROM']`, `serviceYearMonths(sy)` (Sep→Ago), `openingBalance(congreId, ym)` (fila explícita si existe, si no arrastre del mes anterior), `buildS26(congreId, ym)` (filas con saldo corrido + totales por columna + saldos finales), `buildS30(congreId, ym)` (a…k + `box_kingdom` + movimientos por cuenta), `buildS25c(congreId, sy, quarter)`, `buildSummary(congreId, sy)`, `buildReconcile(congreId, ym)`.
- **Expected if worked:** Importable desde los routes sin ciclos; `buildS26` de un mes con las 17 transacciones de la captura reproduce `Total general 4792`.
- **Expected if failed:** Saldo corrido acumula transferencias (total general infla) → el reductor está sumando `transfer` como ingreso.
- **Most likely cause:** No excluir `type='transfer'` del cálculo del total general.
- **Countermove:** Regla única: `transfer` resta en `account` y suma en `to_account`; su efecto neto en el total es 0. Escribir el reductor con ese invariante explícito y probarlo con los números de la sección Recon.
- **Downstream:** Si la aritmética queda mal aquí, S-26, S-30 y S-25c quedan mal a la vez. Este es el movimiento de mayor riesgo.

### Move 3: Routes de datos — `transactions`, `codes`, `config`, `saldo-inicial`

- **Action:** Crear bajo `src/app/api/cuentas/`: `transactions/route.ts` (GET/POST/PUT/DELETE), `codes/route.ts` (GET con auto-seed del catálogo por congregación en el primer GET, POST, DELETE), `config/route.ts` (GET/PUT), `saldo-inicial/route.ts` (GET/PUT). Cada handler: `getSessionContext()` → `canAccessCuentas()` → toda query con `WHERE congregation_id = ?`. Mutaciones con `AND congregation_id = ?` y `changes === 0 → 404`.
- **Expected if worked:** `GET /api/cuentas/codes` devuelve los 10 códigos sembrados; `POST` de transacción responde la fila creada.
- **Expected if failed:** `no such table` → servidor no reiniciado tras Move 1. `403` → usuario sin permiso `cuentas`.
- **Most likely cause:** El singleton `_db` en memoria mantiene el schema viejo.
- **Countermove:** Reiniciar el proceso Next (`pm2 reload` en VPS / matar `npm run dev`).

### Move 4: Route de reportes — `/api/cuentas/reports`

- **Action:** Un solo handler `GET` con `?kind=s26|s30|s25c|summary|reconcile` + parámetros (`ym`, `sy`, `quarter`), delegando a las funciones de Move 2. Mismo guard de congregación.
- **Expected if worked:** `?kind=s30&ym=2026-07` devuelve `{a,b,c,d,e,f,g,box_kingdom,h,i,j,k,...}` con `k === e`.
- **Expected if failed:** `k !== e` → la conciliación no cuadra.
- **Most likely cause:** `(i)` incluye transferencias, o `(a)` no lee el saldo inicial del mes correcto.
- **Countermove:** Assert en el propio payload: devolver `reconciled: Math.abs(k-e) < 0.01` y mostrarlo en la UI. Si es `false`, el bug es visible en pantalla en vez de silencioso.

### Move 5: Route de cierre de mes — `/api/cuentas/cierre-mes`

- **Action:** `POST {ym, publishers, correction?}`. Calcula la remesa de obra mundial del mes (`OM_INCOME` recibidos − ya remesados) y genera la transacción de egreso `SOM` desde `corriente`. Idempotente: si ya existe cierre para el mes, exige `correction: true` y reemplaza las transacciones de cierre previas en vez de duplicarlas.
- **Expected if worked:** Ejecutar dos veces sin `correction` → segunda llamada responde `409` con "ya existe cierre para este mes".
- **Expected if failed:** Se duplican las remesas y el saldo se descuadra.
- **Most likely cause:** Falta marcar las transacciones generadas por cierre (p. ej. `notes = '[cierre]'` o `receipt_ref = 'CIERRE-<ym>'`) y por tanto no se pueden detectar ni reemplazar.
- **Countermove:** Marcar con `receipt_ref = 'CIERRE-' + ym` y buscar por ese prefijo. Confirmar antes de borrar.
- **Downstream:** Acción destructiva sobre datos contables → según CLAUDE.md, la UI debe pedir confirmación explícita antes de una corrección de cierre.

### Move 6: UI completa `src/app/cuentas/page.tsx`

- **Action:** Reemplazar la página del commit `be6a044` por una con navegación de secciones que replique el legacy: **Hoja S-26** (grid de 10 columnas, fila de saldo inicial editable, formulario de asiento, filtros por cuenta/tipo, fila de totales, 4 tarjetas de saldo), **Informe S-30** (bloques a→g + página 2 h→k + movimientos por cuenta), **Formularios** (S-26/S-30/S-25c en layout imprimible con `window.print()`), **Relación I/E** (gráfico de barras SVG inline, sin dependencias nuevas), **Análisis Contables**, **Códigos CT** (alta/baja), **Arqueo de Caja** (modal con denominaciones MXN), **Cierre de Mes** (modal wizard con publicadores). Selector de año de servicio + rejilla de 12 meses Sep→Ago.
- **Expected if worked:** `/cuentas` sin iframe; el grid reproduce la captura de producción; imprimir da un formulario oficial legible.
- **Expected if failed:** Error de tipos en el payload de reportes; o el grid desalineado por `colSpan` incorrecto en el `thead` de dos niveles.
- **Most likely cause:** El header de dos niveles necesita `rowSpan={2}` en Fecha/Descripción/CT/Saldo y `colSpan={2}` en cada cuenta.
- **Countermove:** Construir el `thead` exactamente como la tabla de la captura: fila 1 con 4 celdas `rowSpan=2` + 3 celdas `colSpan=2`; fila 2 con 6 celdas Entrada/Salida.

### Move 7: Añadir `'cuentas'` al gate de módulos y limpiar residuos

- **Action:** Confirmar que `MODULES` ya expone la clave `cuentas` (existe) y que no queda ninguna referencia a `CUENTAS_INTERNAL_URL`, `CUENTAS_MASTER_SECRET`, `NEXT_PUBLIC_CUENTAS_URL` ni a `/api/cuentas-admin` (ya eliminados en `be6a044`).
- **Expected if worked:** `grep -rn "CUENTAS_\|cuentas-admin" src/` → sin resultados.
- **Expected if failed:** Alguna referencia sobrevive en `super-admin/page.tsx`.
- **Countermove:** Eliminar la referencia y su import de icono huérfano (`Banknote`, `ShieldAlert`, `KeyRound`).

### Move 8: Verificación aritmética contra los datos reales

- **Action:** Sembrar en una BD de prueba las 17 transacciones de Julio 2026 de la captura y el saldo inicial `{caja:1925, corriente:586, sucursal:0}`. Verificar: totales de columna `5420/9427/9427/700/0/0`, saldos `-2082 / 6874 / 0`, total general `4792`, y S-30 `b=5420, c=700, d=4720, e=7231, k=7231`.
- **Expected if worked:** Los seis números coinciden exactamente.
- **Expected if failed:** Cualquier discrepancia → la aritmética de Move 2 está mal.
- **Countermove:** Aislar: primero comprobar los totales de columna (suma simple), después los saldos por cuenta, al final el total general. El primer nivel que falle localiza el bug.
- **Downstream:** **No hacer push si este movimiento falla.** Datos contables incorrectos son peores que un módulo ausente.

### Move 9: Verificación de aislamiento multi-congregación

- **Action:** Con dos usuarios de congregaciones distintas: A crea una transacción; B consulta `GET /api/cuentas/transactions` (debe venir vacío), `GET /api/cuentas/reports?kind=s26` (ceros) y `DELETE ?id=<de A>` (debe dar 404).
- **Expected if worked:** B no ve nada de A; el DELETE ajeno da 404.
- **Expected if failed:** B ve datos de A → falla de aislamiento.
- **Most likely cause:** Una query de reportes construida sin el `WHERE congregation_id = ?`, o `congreId` nulo que hace que el filtro se omita.
- **Countermove:** Auditar `src/lib/cuentas.ts`: **toda** función debe recibir `congreId` como primer parámetro obligatorio y usarlo en cada `prepare`. Ninguna query sin ese filtro.

### Move 10: Build, commit y deploy

- **Action:** `npx tsc --noEmit` → `git status` (revisar que no entren `.env` ni `data/msp.db`) → commit → `git push vps vps-selfhosted` desde el directorio del proyecto → reload en el VPS.
- **Expected if worked:** Push aceptado; `congregaciontj.duckdns.org/cuentas` muestra la UI nativa, no el iframe.
- **Expected if failed:** `could not read Username for 'https://github.com'` → el push debe correrlo el usuario en su máquina (el sandbox no tiene credenciales). `error: src refspec ... does not match any` → se ejecutó fuera del directorio del proyecto.
- **Countermove:** Entregar al usuario el comando exacto con `cd` al directorio del proyecto incluido.

---

## Supuestos no resueltos

| Supuesto | Impacto | Quién lo resuelve |
|---|---|---|
| **Descripciones exactas de los códigos CT.** Los códigos (`C, OM, DO, DK, OI, D, OV, SOM, RE, ROM`) están confirmados por el bundle; sus descripciones literales están en la BD del legacy, protegida por auth. Se sembrarán descripciones estándar JW editables desde la UI. | Bajo — el código es lo que gobierna los reportes; la descripción es etiqueta. | Usuario: si alguna descripción difiere, corregirla en Códigos CT (o pegar aquí el CSV del respaldo). |
| **Reimportación del respaldo.** El usuario tiene respaldo `.db`/`.csv` del legacy. No se importa en esta misión. | Medio — los saldos arrancan en cero salvo que se capture el saldo inicial. | Usuario: decidir si quiere un importador de CSV como paso siguiente. |
| **Lógica exacta de "Cierre de Mes".** Se sabe que recibe `publishers` y genera gastos automáticos; la fórmula concreta (¿resolución mensual por publicador?) está en el servidor legacy. Se implementa la remesa OM del mes, que es la parte verificable. | Medio — si hay además una resolución mensual calculada por publicadores, faltará ese asiento. | Usuario: confirmar qué asientos genera el cierre en la app actual. |
| **Campo `state` de la congregación.** MSP tiene `name`/`city`, no `state` (MICH). Se añade en `cuentas_config`. | Bajo. | Ninguno — resuelto por diseño. |

---

## Condiciones de aborto

1. **Move 8 falla** (cualquier número no coincide con la captura de producción) → **detener antes del push**. Reportar qué número difiere y en cuánto.
2. **Move 9 muestra fuga entre congregaciones** → detener. Es el requisito central de la misión.
3. **`npx tsc --noEmit` falla y la corrección exigiría cambiar el modelo de datos** → detener y reportar; no improvisar un modelo distinto al del legacy.
4. **El usuario confirma que el cierre de mes genera asientos adicionales no implementados** → no marcar el módulo Cierre como completo; dejarlo explícitamente como parcial.
5. **Si aparece necesidad de borrar transacciones existentes** (p. ej. al corregir un cierre) → confirmar con el usuario antes, según invariante de CLAUDE.md.
