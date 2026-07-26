# War-game: fallos de despliegue de Cuentas y cómo evitarlos
> Executor: este brief documenta cuatro fallos ya ocurridos, su causa raíz verificada y la defensa que los previene. Ante un síntoma nuevo, busca primero si encaja en uno de los patrones de abajo antes de improvisar.

## Objetivo de la misión

Que el módulo Cuentas funcione en local y en el VPS, y que la clase de fallo que lo rompió no pueda repetirse en silencio. Éxito medible:

- `npm run check:client` y `node scripts/check-schema.mjs` pasan.
- `/cuentas` abre, crea una transferencia y la refleja en el grid con SALDO invariante.
- `congregaciontj.duckdns.org/cuentas` sirve la UI nativa, no el iframe de Vercel.

---

## Recon: qué falló realmente

### Fallo 1 — `Module not found: Can't resolve 'fs'`

**Cadena:** `cuentas/page.tsx` → `ImportPanel.tsx` (`'use client'`) → `csvImport.ts` → `cuentas.ts` → `sqlite.ts` → `better-sqlite3`.

`csvImport.ts` solo necesitaba los enums `ACCOUNTS`/`TYPES`, pero al tomarlos de `cuentas.ts` arrastró el driver nativo hasta el navegador. Un import de tipos y constantes basta para contaminar un bundle si el módulo de origen tiene efectos de servidor.

**Defensa:** `src/lib/cuentasDomain.ts` (isomórfico) separa dominio de acceso a datos, y `scripts/check-client-imports.mjs` recorre el grafo desde cada módulo `'use client'` y falla si alcanza `better-sqlite3` o builtins de Node. Enganchado a `prebuild`.

### Fallo 2 — `no such table: cuentas_saldo_inicial` (causa raíz de tres síntomas)

Este es el importante. `schema.sql` corre en cada arranque y es idempotente, pero **no está ordenado por dependencias** y `exec()` aborta el script entero al primer error:

```
CREATE TABLE IF NOT EXISTS cuentas_codes ...          → creada
CREATE TABLE IF NOT EXISTS cuentas_transactions ...   → NO-OP: ya existía con la forma vieja
CREATE INDEX ... ON cuentas_transactions(congregation_id, code)
                                                      → ERROR: no existe la columna `code`
                                                      → aborta TODO lo que sigue
CREATE TABLE IF NOT EXISTS cuentas_saldo_inicial ...  → nunca se ejecutó
CREATE TABLE IF NOT EXISTS cuentas_config ...         → nunca se ejecutó
```

De ahí salieron, todos a la vez:
- `no such table: cuentas_saldo_inicial` al abrir cualquier mes.
- `table cuentas_transactions has no column named to_account` al importar o guardar.
- «el CSV no importó toda la información» — no importó **nada**: el INSERT fallaba en la primera fila.
- «arqueo de caja no funciona» — el modal depende del saldo, que venía de un reporte que reventaba.

**Lección:** `CREATE TABLE IF NOT EXISTS` es una trampa cuando la tabla ya existe con otra forma. No avisa, no migra, y el fallo aparece lejos de la causa.

**Defensa:**
1. `migrateCuentasLegacy()` en `sqlite.ts`, ejecutada **antes** del schema: detecta la forma vieja (`destination_account`), reconstruye la tabla y **migra los datos** traduciendo enums (`entrada`→`income`, `recibido`→`caja`), y funde `cuentas_ct_codes` en `cuentas_codes`.
2. `execSchema()` reintenta sentencia a sentencia si `exec()` falla, de modo que un error aislado ya no puede dejar media base sin crear. Los fallos reales se reportan por `console.error`; los «ya existe» se ignoran.
3. `scripts/check-schema.mjs` compara la base contra `schema.sql` y lista tablas y columnas faltantes.

### Fallo 3 — Producción sigue mostrando Vercel

Dos pasos independientes que se confunden con uno:

```
git push origin vps-selfhosted     ← lleva el código a GitHub
bash deploy-vps.sh                 ← EN EL SERVIDOR: pull + build + PM2 restart
```

Empujar no despliega. Mientras no corra el segundo, PM2 sigue sirviendo el build anterior.

Además `deploy-vps.sh` está **desactualizado**: sigue inyectando `CUENTAS_INTERNAL_URL` y `CUENTAS_MASTER_SECRET` en `ecosystem.config.cjs` y verificando `cuentas-congregacion-bay.vercel.app`. Esas variables ya no las lee nadie (el proxy se eliminó en `be6a044`), pero la verificación final del script puede reportar ERROR y hacer creer que el despliegue falló.

### Fallo 4 — No se pudo ejecutar la aplicación durante el desarrollo

`better-sqlite3` trae un binario que exige **GLIBC 2.38**; el entorno de ejecución de Claude es **Ubuntu 22.04 con GLIBC 2.35**. `next build` además necesita el binario SWC de linux/arm64, ausente y sin acceso a npm para descargarlo.

Consecuencia: se validó con `tsc`, ESLint y 68 aserciones del motor contable sobre un sustituto de SQLite — ninguna de esas tres herramientas mira el grafo de bundles ni el estado real de la base. Los fallos 1 y 2 viven exactamente en ese hueco.

**Sobre «instalar GLIBC 2.38»:** no procede. GLIBC es la biblioteca C del sistema; en Ubuntu 22.04 no se actualiza a 2.38 sin cambiar de versión del sistema operativo, y forzarlo rompe todos los binarios enlazados, incluido el shell. La vía correcta es la que ya está en uso: ejecutar y probar en la máquina del usuario a través de la extensión de Chrome.

---

## Movimientos

### Move 1: Comprobar que la base coincide con el schema
- **Action:** `node scripts/check-schema.mjs` (y en el VPS, `DB_PATH=/opt/msp/data/msp.db node scripts/check-schema.mjs`).
- **Si funcionó:** «OK · N tablas declaradas presentes y completas».
- **Si falló:** lista de tablas o columnas ausentes.
- **Causa probable:** una tabla existía con otra forma y `IF NOT EXISTS` no la tocó.
- **Countermove:** añadir la migración en `migrateCuentasLegacy()` de `sqlite.ts`. Si los datos son desechables, borrar `data/msp.db` y reiniciar. **Nunca** borrar la base del VPS sin respaldo previo.

### Move 2: Comprobar que no hay código de servidor en el bundle
- **Action:** `npm run check:client`.
- **Si funcionó:** «OK · N módulos de cliente revisados».
- **Si falló:** imprime la cadena completa de imports hasta el módulo de servidor.
- **Countermove:** mover constantes y tipos puros a `cuentasDomain.ts`; dejar en `cuentas.ts` solo lo que toca la base.

### Move 3: Reiniciar el servidor tras cambiar `sqlite.ts`
- **Action:** parar y relanzar `npm run dev`.
- **Si funcionó:** en consola aparece `[sqlite] cuentas_transactions migrada (N fila(s))` la primera vez.
- **Si falló:** los errores persisten pese a la migración.
- **Causa probable:** `_db` es un singleton de módulo; la conexión viva conserva el estado anterior.
- **Countermove:** reinicio completo del proceso, no recarga en caliente.

### Move 4: Probar la UI de verdad, en Chrome
- **Action:** abrir `localhost:3000/cuentas`; crear una transferencia con código `D`; comprobar el grid.
- **Si funcionó:** una sola fila con Salida en la cuenta origen y Entrada en la destino, y la columna **SALDO sin moverse** — es el invariante contable.
- **Si falló:** el SALDO cambia con una transferencia.
- **Countermove:** revisar `apply()` en `cuentas.ts`; una transferencia resta en `account` y suma en `to_account`, efecto neto 0.

### Move 5: Desplegar de verdad
- **Action:** `git push origin vps-selfhosted`, luego **en el servidor** `bash deploy-vps.sh`.
- **Si funcionó:** `/cuentas` en el dominio muestra la UI nativa, sin iframe.
- **Si falló:** sigue el iframe de Vercel.
- **Causa probable:** `deploy-vps.sh` no se ejecutó, o `npm run build` falló en el servidor y PM2 quedó con el build previo.
- **Countermove:** en el servidor, `cd /opt/msp && git log --oneline -1` para confirmar que el commit llegó, y revisar la salida de `npm run build`. Con el hook nuevo, un fallo de `check:client` detiene el build con la cadena exacta.

### Move 6: Limpiar `deploy-vps.sh`
- **Action:** quitar del script la inyección de `CUENTAS_INTERNAL_URL` / `CUENTAS_MASTER_SECRET` y la verificación contra Vercel; añadir `node scripts/check-schema.mjs` tras el build.
- **Si funcionó:** el script termina sin líneas «Cuentas /api/master: ERROR».
- **Downstream:** evita diagnósticos falsos en cada despliegue futuro.

---

## Supuestos no resueltos

| Supuesto | Impacto | Quién lo resuelve |
|---|---|---|
| **Qué contiene el CSV de La Estación.** El importador es tolerante, pero nadie ha visto el archivo real. Si sus columnas no se autodetectan, hay que mapearlas a mano antes de verificar. | Medio | Usuario: subir el CSV y revisar el mapeo propuesto en la pantalla de verificación. |
| **Estado de la base del VPS.** No se ha inspeccionado. Si allí también quedó una `cuentas_transactions` con la forma vieja, la migración se aplicará al primer arranque, pero conviene comprobarlo. | Medio | Ejecutar `check-schema.mjs` en el servidor tras desplegar. |
| **Monto por publicador de la resolución mensual.** Sigue en 0, así que ese asiento no se genera. | Bajo | Usuario: fijarlo en Configuración → Cierre de mes. |

## Condiciones de aborto

1. `check-schema.mjs` falla **en el VPS** tras desplegar → detener y reportar antes de que nadie capture datos contables sobre una base incompleta.
2. La columna SALDO se mueve con una transferencia → hay un error en el motor contable; no usar el módulo hasta corregirlo.
3. Hace falta borrar o reconstruir una tabla con datos reales → confirmar con el usuario antes, según invariante de CLAUDE.md.
