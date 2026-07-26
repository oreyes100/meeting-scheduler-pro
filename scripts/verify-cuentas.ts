/**
 * Verificación aritmética del motor de Cuentas contra los datos reales
 * capturados de la app legacy en producción (Julio 2026, congregación ESTACION).
 *
 * Uso:  DB_PATH=/tmp/cuentas-test.db npx ts-node --compilerOptions '{"module":"commonjs"}' scripts/verify-cuentas.ts
 *
 * Números esperados (leídos de la captura de pantalla de producción):
 *   Totales de columna : Recibido E 5420 / S 9427 · Principal E 9427 / S 700 · Secundaria 0 / 0
 *   Saldos finales     : Recibido -2082 · Principal 6874 · Secundaria 0
 *   Total general      : 4792
 *   S-30               : a 2511 · b 5420 · c 700 · d 4720 · e 7231 · k 7231
 */
import { randomUUID } from 'crypto';

import {
  buildS26, buildS30, buildS25c, buildSummary, buildReconcile, DEFAULT_CODES, totalOf,
} from '../src/lib/cuentas';
import { getDb as db } from '../src/lib/sqlite';

const CONGRE_A = 'congre-estacion';
const CONGRE_B = 'congre-tiripetio';

const d = db();
d.exec(`INSERT OR IGNORE INTO congregations (id, name, city) VALUES
  ('${CONGRE_A}', 'La Estación', 'Pátzcuaro'),
  ('${CONGRE_B}', 'Universidad Tiripetio', 'Morelia')`);

for (const c of DEFAULT_CODES) {
  d.prepare(`INSERT OR IGNORE INTO cuentas_codes (id, code, description, kind, sort_order, congregation_id)
             VALUES (?,?,?,?,?,?)`).run(randomUUID(), c.code, c.description, c.kind, c.sort_order, CONGRE_A);
}

// Saldo inicial de julio 2026 (de MOVIMIENTOS POR CUENTA del S-30 real:
// Recibido 1925 + Principal 586 + Secundaria 0 = 2511)
d.prepare(`INSERT INTO cuentas_saldo_inicial (congregation_id, ym, caja, corriente, sucursal)
           VALUES (?,?,?,?,?)`).run(CONGRE_A, '2026-07', 1925, 586, 0);

// Las 17 transacciones de julio 2026 exactamente como aparecen en la captura.
type Seed = [day: number, desc: string, code: string, type: string, account: string, to: string | null, amount: number];
const SEED: Seed[] = [
  [1,  'Donaciones (Obra mundial)',                        'OM', 'income',   'caja', null,        550],
  [1,  'Donaciones (Gastos de la congregación)',           'C',  'income',   'caja', null,        710],
  [4,  'Deposito a caja de efectivo',                      'D',  'transfer', 'caja', 'corriente', 1260],
  [5,  'Donaciones (Gastos de la congregación)',           'C',  'income',   'caja', null,        1150],
  [5,  'Donaciones (Obra mundial)',                        'OM', 'income',   'caja', null,        410],
  [5,  'Deposito a caja de efectivo',                      'D',  'transfer', 'caja', 'corriente', 1560],
  [5,  'Orador visitante',                                 'OV', 'expense',  'corriente', null,   300],
  [8,  'Donaciones (Obra mundial)',                        'OM', 'income',   'caja', null,        200],
  [8,  'Donaciones (Gastos de la congregación)',           'C',  'income',   'caja', null,        500],
  [8,  'Deposito a caja de efectivo',                      'D',  'transfer', 'caja', 'corriente', 700],
  [8,  'Deposito a caja de efectivo',                      'D',  'transfer', 'caja', 'corriente', 2875],
  [12, 'Donaciones (Obra mundial)',                        'OM', 'income',   'caja', null,        950],
  [12, 'Donaciones (Gastos de la congregación)',           'C',  'income',   'caja', null,        950],
  [12, 'COOPERACIÓN A ORADOR VISITANTE',                   'OV', 'expense',  'corriente', null,   400],
  [15, 'Deposito a caja de efectivo (Transferencia recibida)', 'D', 'transfer', 'caja', 'corriente', 1700],
  [16, 'Deposito a caja de efectivo',                      'D',  'transfer', 'caja', 'corriente', 1332],
];

for (const [day, desc, code, type, account, to, amount] of SEED) {
  d.prepare(`INSERT INTO cuentas_transactions
    (id, date, type, account, to_account, code, description, amount, congregation_id)
    VALUES (?,?,?,?,?,?,?,?,?)`)
   .run(randomUUID(), `2026-07-${String(day).padStart(2,'0')}`, type, account, to, code, desc, amount, CONGRE_A);
}

/* ── Aserciones ──────────────────────────────────────────────────────────────── */

let failures = 0;
function check(label: string, actual: number, expected: number) {
  const ok = Math.abs(actual - expected) < 0.01;
  if (!ok) failures++;
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${label.padEnd(46)} esperado ${expected.toFixed(2).padStart(10)}  obtenido ${actual.toFixed(2).padStart(10)}`);
}
function checkBool(label: string, actual: boolean, expected = true) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${label.padEnd(46)} ${actual}`);
}

const s26 = buildS26(CONGRE_A, '2026-07');

console.log('\n── S-26 · Totales de columna ──');
check('Recibido / Entrada',   s26.totals.caja.in,        5420);
check('Recibido / Salida',    s26.totals.caja.out,       9427);
check('Principal / Entrada',  s26.totals.corriente.in,   9427);
check('Principal / Salida',   s26.totals.corriente.out,   700);
check('Secundaria / Entrada', s26.totals.sucursal.in,       0);
check('Secundaria / Salida',  s26.totals.sucursal.out,      0);

console.log('\n── S-26 · Saldo inicial y saldos finales ──');
// NOTA SOBRE LOS ESPERADOS: la app legacy muestra en la MISMA pantalla de julio
// 2026 dos cifras de fondos finales incompatibles: el S-30 informa 7231 y las
// tarjetas de saldo 4792. La causa está probada con sus propios datos: el S-25c
// del trimestre Jun-Jul-Ago declara fondos iniciales 0, recibido 15512 y
// desembolsos 10720 → 0 + 15512 − 10720 = 4792. Eso implica que julio debía
// abrir en 72, pero su saldo inicial fue editado a mano a 2511. La diferencia,
// 2511 − 72 = 2439, es exactamente la que separa 7231 de 4792.
// Aquí se verifica la cadena internamente consistente (apertura 2511 → cierre
// 7231) y por separado que el motor DETECTE el descuadre, en vez de replicarlo.
check('Saldo inicial (total)',      s26.openingTotal,       2511);
check('Saldo final Recibido',       s26.closing.caja,      -2082);
check('Saldo final Principal',      s26.closing.corriente,  9313); // 586 + 9427 − 700
check('Saldo final Secundaria',     s26.closing.sucursal,       0);
check('TOTAL GENERAL',              s26.closingTotal,       7231); // = S-30 (e) y (k)

console.log('\n── S-26 · La transferencia no mueve el total ──');
const firstTransfer = s26.rows.find(r => r.type === 'transfer')!;
check('Saldo tras 1.ª transferencia (D 1260)', firstTransfer.saldo, 3771);

const s30 = buildS30(CONGRE_A, '2026-07');
console.log('\n── S-30 · Informe mensual ──');
check('(a) Fondos a comienzo de mes', s30.a, 2511);
check('(b) Total recibido',           s30.b, 5420);
check('(c) Total de gastos',          s30.c,  700);
check('(d) Sobrante / déficit',       s30.d, 4720);
check('(e) Fondos a fin de mes',      s30.e, 7231);
check('(h)',                          s30.h, 2511);
check('(i) Recibido',                 s30.i, 5420);
check('(j) Desembolsos',              s30.j,  700);
check('(k) = h + i − j',              s30.k, 7231);
checkBool('(k) coincide con (e)',     s30.reconciled);

console.log('\n── S-30 · Desglose por código ──');
check('Recibido código C',  s30.incomeByCode.find(r => r.code === 'C')?.total ?? 0, 3310);
check('Recibido código OM', s30.incomeByCode.find(r => r.code === 'OM')?.total ?? 0, 2110);
check('Gastos código OV',   s30.expenseByCode.find(r => r.code === 'OV')?.total ?? 0, 700);

console.log('\n── S-30 · Movimientos por cuenta ──');
const mv = (a: string) => s30.movements.find(m => m.account === a)!;
check('Recibido · saldo anterior',  mv('caja').previous,       1925);
check('Recibido · saldo actual',    mv('caja').current,       -2082);
check('Principal · saldo anterior', mv('corriente').previous,   586);
check('Principal · saldo actual',   mv('corriente').current,   9313);

console.log('\n── Detección del descuadre de saldo inicial (bug del legacy) ──');
// Escenario: junio arranca en 0, recibe 100 y gasta 40 → arrastre a julio = 60.
// Pero se declara a mano un saldo inicial de julio de 500. El motor debe avisar.
const CONGRE_C = 'congre-descuadre';
d.exec(`INSERT OR IGNORE INTO congregations (id, name) VALUES ('${CONGRE_C}', 'Prueba Descuadre')`);
d.prepare(`INSERT INTO cuentas_saldo_inicial (congregation_id, ym, caja, corriente, sucursal)
           VALUES (?,?,?,?,?)`).run(CONGRE_C, '2026-06', 0, 0, 0);
d.prepare(`INSERT INTO cuentas_transactions (id,date,type,account,to_account,code,description,amount,congregation_id)
           VALUES (?,?,?,?,?,?,?,?,?)`)
 .run(randomUUID(), '2026-06-05', 'income', 'caja', null, 'C', 'Donación', 100, CONGRE_C);
d.prepare(`INSERT INTO cuentas_transactions (id,date,type,account,to_account,code,description,amount,congregation_id)
           VALUES (?,?,?,?,?,?,?,?,?)`)
 .run(randomUUID(), '2026-06-20', 'expense', 'caja', null, 'OV', 'Gasto', 40, CONGRE_C);

const carriedOnly = buildS26(CONGRE_C, '2026-07');
check('Sin declarar: arrastre de junio', carriedOnly.openingTotal, 60);
checkBool('Sin declarar: no hay descuadre', carriedOnly.openingAudit.matches);

d.prepare(`INSERT INTO cuentas_saldo_inicial (congregation_id, ym, caja, corriente, sucursal)
           VALUES (?,?,?,?,?)`).run(CONGRE_C, '2026-07', 500, 0, 0);
const declared = buildS26(CONGRE_C, '2026-07');
check('Declarado a mano se respeta',        declared.openingTotal,             500);
check('Arrastre real sigue siendo 60',      totalOf(declared.openingAudit.carried), 60);
check('Diferencia detectada',               declared.openingAudit.diffTotal,   440);
checkBool('Descuadre señalado',             declared.openingAudit.matches, false);
const recC = buildReconcile(CONGRE_C, '2026-07');
checkBool('Análisis contables lo reporta',
  recC.checks.some(c => c.label.startsWith('Saldo inicial declarado') && !c.ok));

console.log('\n── Aislamiento multi-congregación ──');
const s26b = buildS26(CONGRE_B, '2026-07');
check('Congregación B · filas',         s26b.rows.length,      0);
check('Congregación B · total general', s26b.closingTotal,     0);
const s30b = buildS30(CONGRE_B, '2026-07');
check('Congregación B · (b) recibido',  s30b.b,                0);

console.log('\n── S-25c · Auditoría 4.º trimestre (Jun-Jul-Ago) ──');
const s25c = buildS25c(CONGRE_A, '2025/2026', 4);
check('Julio · recibido',      s25c.months.find(m => m.ym === '2026-07')!.income,   5420);
check('Julio · desembolsos',   s25c.months.find(m => m.ym === '2026-07')!.expense,   700);
check('Julio · donaciones OM', s25c.months.find(m => m.ym === '2026-07')!.omIncome, 2110);
check('Julio · remesas OM',    s25c.months.find(m => m.ym === '2026-07')!.omRemit,     0);
check('Trimestre · recibido',  s25c.totals.income,                                  5420);

console.log('\n── Relación I/E · año de servicio 2025/2026 ──');
const sum = buildSummary(CONGRE_A, '2025/2026');
check('Meses en el año de servicio', sum.months.length, 12);
checkBool('Empieza en septiembre', sum.months[0].ym === '2025-09');
checkBool('Termina en agosto',     sum.months[11].ym === '2026-08');
check('Ingresos del año',          sum.totals.income, 5420);

console.log('\n── Análisis contables ──');
const rec = buildReconcile(CONGRE_A, '2026-07');
for (const c of rec.checks) console.log(`  ${c.ok ? 'OK  ' : 'AVISO'} ${c.label} — ${c.detail}`);

console.log(`\n${failures === 0 ? '✅ TODAS LAS ASERCIONES PASARON' : `❌ ${failures} ASERCIÓN(ES) FALLARON`}\n`);
process.exit(failures === 0 ? 0 : 1);
