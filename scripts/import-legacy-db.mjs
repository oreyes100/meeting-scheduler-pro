#!/usr/bin/env node
/**
 * Importa el respaldo SQLite del programa de contabilidad legacy a MSP.
 *
 * Uso:
 *   node scripts/import-legacy-db.mjs <respaldo.db> <congregation_id>            # simulacro
 *   node scripts/import-legacy-db.mjs <respaldo.db> <congregation_id> --apply    # escribe
 *   … --replace   borra las transacciones de Cuentas que ya tenga esa congregación
 *   … --db /ruta/msp.db     (por defecto data/msp.db o $DB_PATH)
 *
 * Requiere Node 22+ (usa el módulo nativo node:sqlite, sin dependencias).
 *
 * ── Diferencias de modelo que resuelve ──────────────────────────────────────
 *
 * 1. TRANSFERENCIAS. El legacy guarda cada transferencia como DOS filas: una
 *    `transfer` en la cuenta origen y otra `transfer_in` en la destino, ambas
 *    por el mismo importe. MSP usa UNA fila con `account` + `to_account`, que es
 *    además como se imprime en el S-26 (una línea con dos columnas). Se importan
 *    solo las filas `transfer` y se descartan las `transfer_in`.
 *
 * 2. SALDO INICIAL. El legacy lo guarda en `config` como
 *    `saldo_inicial_override_YYYY-MM` con un importe único. Verificado contra los
 *    datos reales de La Estación: ese importe se aplica íntegro a la Cuenta
 *    Principal (`corriente`). Junio abre con 2439 en corriente, cierra en
 *    caja 1925 / corriente 586 = 2511, que es exactamente el saldo inicial que
 *    el programa mostraba en julio.
 *
 * 3. CÓDIGOS. `codes.category` (income/expense/transfer) equivale a
 *    `cuentas_codes.kind`. Se conservan las descripciones del respaldo.
 *
 * No se importan `users` ni `sessions`: el acceso lo gobierna MSP.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

/* ── Argumentos ─────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const positional = argv.filter((a, i) =>
  !a.startsWith('--') && argv[i - 1] !== '--db');

const [LEGACY, CONGRE] = positional;
const APPLY = argv.includes('--apply');
const REPLACE = argv.includes('--replace');
const MSP = flag('--db') || process.env.DB_PATH || 'data/msp.db';

if (!LEGACY || !CONGRE) {
  console.error('Uso: node scripts/import-legacy-db.mjs <respaldo.db> <congregation_id> [--apply] [--db ruta]');
  process.exit(2);
}
for (const f of [LEGACY, MSP]) {
  if (!fs.existsSync(f)) { console.error(`No existe: ${f}`); process.exit(2); }
}

const money = (n) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const round2 = (n) => Math.round(n * 100) / 100;

/* ── Lectura del respaldo ───────────────────────────────────────────────────── */

const src = new DatabaseSync(LEGACY, { readOnly: true });

const config = Object.fromEntries(
  src.prepare('SELECT key, value FROM config').all().map(r => [r.key, r.value]));
const codes = src.prepare('SELECT code, description, category FROM codes').all();
const txAll = src.prepare('SELECT * FROM transactions ORDER BY date, id').all();

// Solo la pierna `transfer`; `transfer_in` es su duplicado en la cuenta destino.
const tx = txAll.filter(r => r.type !== 'transfer_in');

const KINDS = new Set(['income', 'expense', 'transfer']);
const ACCOUNTS = new Set(['caja', 'corriente', 'sucursal']);

/* ── Validación ─────────────────────────────────────────────────────────────── */

const issues = [];
const rows = [];

for (const r of tx) {
  const where = `id ${r.id} (${r.date})`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) { issues.push(`${where}: fecha inválida`); continue; }
  if (!KINDS.has(r.type)) { issues.push(`${where}: tipo «${r.type}» desconocido`); continue; }
  if (!(r.amount > 0)) { issues.push(`${where}: importe ${r.amount}`); continue; }

  const account = r.type === 'transfer' ? (r.from_account || r.account) : r.account;
  const to = r.type === 'transfer' ? r.to_account : null;

  if (!ACCOUNTS.has(account)) { issues.push(`${where}: cuenta «${account}» desconocida`); continue; }
  if (r.type === 'transfer' && (!ACCOUNTS.has(to) || to === account)) {
    issues.push(`${where}: transferencia con destino «${to}» inválido`); continue;
  }

  rows.push({
    date: r.date,
    type: r.type,
    account,
    to_account: to,
    code: r.code ? String(r.code).toUpperCase() : null,
    description: r.description,
    amount: round2(r.amount),
    receipt_ref: r.to62_ref || null,
    notes: r.receipt_text ? String(r.receipt_text).slice(0, 300) : null,
    created_at: r.created_at || null,
  });
}

/* ── Saldos iniciales declarados ────────────────────────────────────────────── */

const openings = Object.entries(config)
  .filter(([k]) => k.startsWith('saldo_inicial_override_'))
  .map(([k, v]) => ({ ym: k.replace('saldo_inicial_override_', ''), corriente: Number(v) || 0 }))
  .filter(o => /^\d{4}-\d{2}$/.test(o.ym));

/* ── Saldos resultantes ─────────────────────────────────────────────────────── */

const balance = { caja: 0, corriente: 0, sucursal: 0 };
for (const o of openings) balance.corriente += o.corriente;
for (const r of rows) {
  if (r.type === 'income') balance[r.account] += r.amount;
  else if (r.type === 'expense') balance[r.account] -= r.amount;
  else { balance[r.account] -= r.amount; balance[r.to_account] += r.amount; }
}
for (const k of Object.keys(balance)) balance[k] = round2(balance[k]);
const total = round2(balance.caja + balance.corriente + balance.sucursal);

const months = [...new Set(rows.map(r => r.date.slice(0, 7)))].sort();

/* ── Informe ────────────────────────────────────────────────────────────────── */

console.log(`\nRespaldo : ${LEGACY}`);
console.log(`Destino  : ${MSP}  ·  congregación ${CONGRE}`);
console.log(`Modo     : ${APPLY ? (REPLACE ? 'APLICAR + REEMPLAZAR' : 'APLICAR (escribe)') : 'SIMULACRO (no escribe)'}\n`);

console.log(`Congregación en el respaldo: ${config.congregacion || '—'} · ${config.ciudad || '—'} · ${config.provincia || '—'}`);
if (config.publishers) console.log(`Publicadores informados: ${config.publishers}`);
console.log('');
console.log(`Transacciones en el respaldo : ${txAll.length}`);
console.log(`  · descartadas «transfer_in» : ${txAll.length - tx.length} (pierna duplicada de cada transferencia)`);
console.log(`  · a importar                : ${rows.length}`);
console.log(`  · con problemas             : ${issues.length}`);
console.log(`Códigos a importar            : ${codes.length}`);
console.log(`Meses cubiertos               : ${months.join(', ') || '—'}`);

if (openings.length) {
  console.log('\nSaldos iniciales declarados (se aplican a la Cuenta Principal):');
  for (const o of openings) console.log(`  · ${o.ym}: ${money(o.corriente)}`);
}

console.log('\nSaldos resultantes:');
console.log(`  Recibido (Donaciones)      ${money(balance.caja).padStart(14)}`);
console.log(`  Cuenta Principal (Caja)    ${money(balance.corriente).padStart(14)}`);
console.log(`  Cuenta Secundaria          ${money(balance.sucursal).padStart(14)}`);
console.log(`  TOTAL GENERAL              ${money(total).padStart(14)}`);

if (issues.length) {
  console.log('\nFilas con problemas (no se importan):');
  for (const i of issues.slice(0, 25)) console.log('  · ' + i);
}

if (!APPLY) {
  console.log('\nSimulacro. Vuelve a ejecutar con --apply para escribir.\n');
  process.exit(0);
}

/* ── Escritura ──────────────────────────────────────────────────────────────── */

const dst = new DatabaseSync(MSP);

const congre = dst.prepare('SELECT id, name FROM congregations WHERE id = ?').get(CONGRE);
if (!congre) { console.error(`\nNo existe la congregación ${CONGRE} en ${MSP}`); process.exit(1); }

const existing = dst.prepare(
  'SELECT COUNT(*) n FROM cuentas_transactions WHERE congregation_id = ?').get(CONGRE).n;

if (existing > 0 && !REPLACE) {
  console.error(`\nLa congregación ya tiene ${existing} transacción(es) de Cuentas.`);
  console.error('Importar encima duplicaría los asientos.');
  console.error('Añade --replace para BORRARLAS y dejar solo lo que trae el respaldo.');
  process.exit(1);
}

if (existing > 0 && REPLACE) {
  console.log(`\n--replace: se eliminarán ${existing} transacción(es) y sus saldos iniciales previos.`);
}

dst.exec('BEGIN');
try {
  if (REPLACE) {
    dst.prepare('DELETE FROM cuentas_transactions WHERE congregation_id = ?').run(CONGRE);
    dst.prepare('DELETE FROM cuentas_saldo_inicial  WHERE congregation_id = ?').run(CONGRE);
  }
  // Códigos: se conservan las descripciones del respaldo.
  const upCode = dst.prepare(`
    INSERT INTO cuentas_codes (id, code, description, kind, sort_order, congregation_id)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(code, congregation_id) DO UPDATE SET
      description = excluded.description, kind = excluded.kind`);
  codes.forEach((c, i) => {
    const kind = KINDS.has(c.category) ? c.category : 'income';
    upCode.run(randomUUID(), c.code, c.description, kind, i, CONGRE);
  });

  // Encabezado de los formularios.
  dst.prepare(`
    INSERT INTO cuentas_config (congregation_id, label, city, state, updated_at)
    VALUES (?,?,?,?, datetime('now'))
    ON CONFLICT(congregation_id) DO UPDATE SET
      label = excluded.label, city = excluded.city, state = excluded.state,
      updated_at = datetime('now')`)
   .run(CONGRE, config.congregacion || null, config.ciudad || null, config.provincia || null);

  // Saldos iniciales.
  const upOpen = dst.prepare(`
    INSERT INTO cuentas_saldo_inicial (congregation_id, ym, caja, corriente, sucursal, updated_at)
    VALUES (?,?,?,?,?, datetime('now'))
    ON CONFLICT(congregation_id, ym) DO UPDATE SET
      caja = excluded.caja, corriente = excluded.corriente,
      sucursal = excluded.sucursal, updated_at = datetime('now')`);
  for (const o of openings) upOpen.run(CONGRE, o.ym, 0, o.corriente, 0);

  // Transacciones.
  const insTx = dst.prepare(`
    INSERT INTO cuentas_transactions
      (id, date, type, account, to_account, code, description, amount,
       receipt_ref, notes, created_at, congregation_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const r of rows) {
    insTx.run(randomUUID(), r.date, r.type, r.account, r.to_account, r.code,
              r.description, r.amount, r.receipt_ref, r.notes, r.created_at, CONGRE);
  }

  dst.exec('COMMIT');
} catch (e) {
  dst.exec('ROLLBACK');
  console.error('\nImportación revertida:', e.message);
  process.exit(1);
}

console.log(`\nImportado en «${congre.name}»: ${rows.length} transacciones, ${codes.length} códigos, ${openings.length} saldo(s) inicial(es).\n`);

if (config.ai_api_key) {
  console.log('AVISO: el respaldo contiene una clave de API de Google en config.ai_api_key.');
  console.log('       No se importa. Guárdala como variable de entorno, nunca en el repositorio,');
  console.log('       y considera rotarla si el archivo ha circulado.\n');
}
