/**
 * Motor contable de Cuentas (S-26 / S-30 / S-25c).
 *
 * Réplica del programa legacy `cuentas-congregacion`. Los enums NO se renombran:
 *   type    : income | expense | transfer
 *   account : caja      → "Recibido (Donaciones)"
 *             corriente → "Cuenta Principal (Caja de dinero)"
 *             sucursal  → "Cuenta Secundaria"
 *
 * INVARIANTE CENTRAL: una transacción `transfer` resta en `account` y suma en
 * `to_account`. Su efecto neto sobre el total general es exactamente 0, por eso
 * no mueve la columna "Saldo" de la hoja S-26.
 *
 * Toda función recibe `congreId` como primer parámetro y lo aplica en cada
 * query: es el único mecanismo de aislamiento entre congregaciones.
 */
import { getDb } from './sqlite';

/* ── Dominio ────────────────────────────────────────────────────────────────── */

export const ACCOUNTS = ['caja', 'corriente', 'sucursal'] as const;
export type Account = (typeof ACCOUNTS)[number];

export const TYPES = ['income', 'expense', 'transfer'] as const;
export type TxType = (typeof TYPES)[number];

export const ACCOUNT_LABELS: Record<Account, string> = {
  caja:      'Recibido (Donaciones)',
  corriente: 'Cuenta Principal (Caja de dinero)',
  sucursal:  'Cuenta Secundaria',
};

export const TYPE_LABELS: Record<TxType, string> = {
  income:   'Entrada (Ingreso)',
  expense:  'Salida (Gasto)',
  transfer: 'Transferencia',
};

/** Códigos que cuentan como donaciones para la obra mundial (S-25c). */
export const OM_INCOME_CODES = ['OM', 'DO'] as const;
/** Códigos que cuentan como remesas de obra mundial enviadas a la sucursal. */
export const OM_REMIT_CODES = ['SOM', 'RE', 'ROM'] as const;
/** Código de la caja de contribuciones "Salones del Reino" (fondos reservados). */
export const KINGDOM_BOX_CODE = 'DK';
/** Código de la caja de contribuciones "Obra Mundial". */
export const WORLDWIDE_BOX_CODE = 'DO';

export const DEFAULT_CODES: { code: string; description: string; kind: TxType; sort_order: number }[] = [
  { code: 'C',   description: 'Donaciones para los gastos de la congregación', kind: 'income',   sort_order: 1 },
  { code: 'OM',  description: 'Donaciones para la obra mundial',               kind: 'income',   sort_order: 2 },
  { code: 'DO',  description: 'Caja de contribuciones — Obra Mundial',          kind: 'income',   sort_order: 3 },
  { code: 'DK',  description: 'Contribuciones para Salones del Reino',          kind: 'income',   sort_order: 4 },
  { code: 'OI',  description: 'Otros ingresos',                                kind: 'income',   sort_order: 5 },
  { code: 'D',   description: 'Depósito a caja de efectivo',                    kind: 'transfer', sort_order: 6 },
  { code: 'OV',  description: 'Orador visitante / discursante',                 kind: 'expense',  sort_order: 7 },
  { code: 'GC',  description: 'Gastos de funcionamiento del Salón del Reino',   kind: 'expense',  sort_order: 8 },
  { code: 'SOM', description: 'Remesa de obra mundial a la sucursal',           kind: 'expense',  sort_order: 9 },
  { code: 'RE',  description: 'Remesa',                                         kind: 'expense',  sort_order: 10 },
  { code: 'ROM', description: 'Remesa de obra mundial',                          kind: 'expense',  sort_order: 11 },
];

export interface Transaction {
  id: string;
  date: string;
  type: TxType;
  account: Account;
  to_account: Account | null;
  code: string | null;
  description: string;
  amount: number;
  receipt_ref: string | null;
  notes: string | null;
}

export type Balance = Record<Account, number>;

const zero = (): Balance => ({ caja: 0, corriente: 0, sucursal: 0 });
const round2 = (n: number) => Math.round(n * 100) / 100;
export const totalOf = (b: Balance) => round2(b.caja + b.corriente + b.sucursal);

/* ── Año de servicio (septiembre → agosto) ──────────────────────────────────── */

export const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/** "2025/2026" → ['2025-09', …, '2026-08'] en orden del año de servicio. */
export function serviceYearMonths(sy: string): string[] {
  const startYear = Number(sy.split('/')[0]);
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = 9 + i;                       // sep = 9
    const year = startYear + Math.floor((m - 1) / 12);
    const month = ((m - 1) % 12) + 1;
    out.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return out;
}

/** El año de servicio al que pertenece un ym (sep inicia uno nuevo). */
export function serviceYearOf(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return m >= 9 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

/** Trimestres del S-25c dentro del año de servicio. */
export const QUARTERS = [
  { n: 1, label: '1.er Trimestre (Sep-Oct-Nov)', offsets: [0, 1, 2] },
  { n: 2, label: '2.º Trimestre (Dic-Ene-Feb)',  offsets: [3, 4, 5] },
  { n: 3, label: '3.er Trimestre (Mar-Abr-May)', offsets: [6, 7, 8] },
  { n: 4, label: '4.º Trimestre (Jun-Jul-Ago)',  offsets: [9, 10, 11] },
];

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES_ES[m - 1]} ${y}`;
}

function prevYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ── Acceso a datos (siempre filtrado por congregación) ─────────────────────── */

function txOfMonth(congreId: string, ym: string): Transaction[] {
  return getDb().prepare(`
    SELECT id, date, type, account, to_account, code, description, amount, receipt_ref, notes
    FROM cuentas_transactions
    WHERE congregation_id = ? AND substr(date, 1, 7) = ?
    ORDER BY date ASC, created_at ASC
  `).all(congreId, ym) as Transaction[];
}

function txBefore(congreId: string, ym: string): Transaction[] {
  return getDb().prepare(`
    SELECT type, account, to_account, amount
    FROM cuentas_transactions
    WHERE congregation_id = ? AND substr(date, 1, 7) < ?
    ORDER BY date ASC, created_at ASC
  `).all(congreId, ym) as Transaction[];
}

/** Aplica una transacción sobre un balance mutable. */
function apply(b: Balance, tx: Pick<Transaction, 'type' | 'account' | 'to_account' | 'amount'>) {
  if (tx.type === 'income') {
    b[tx.account] += tx.amount;
  } else if (tx.type === 'expense') {
    b[tx.account] -= tx.amount;
  } else if (tx.type === 'transfer' && tx.to_account) {
    b[tx.account] -= tx.amount;
    b[tx.to_account] += tx.amount;
  }
}

/**
 * Arrastre real: saldo del mes calculado desde el ancla explícita ANTERIOR a `ym`
 * más todas las transacciones intermedias. Ignora deliberadamente la fila
 * explícita de `ym` — sirve para contrastarla (ver `openingAudit`).
 */
export function carryForward(congreId: string, ym: string): Balance {
  const db = getDb();

  const anchor = db.prepare(
    `SELECT ym, caja, corriente, sucursal FROM cuentas_saldo_inicial
     WHERE congregation_id = ? AND ym < ? ORDER BY ym DESC LIMIT 1`
  ).get(congreId, ym) as (Balance & { ym: string }) | undefined;

  const b: Balance = anchor
    ? { caja: anchor.caja, corriente: anchor.corriente, sucursal: anchor.sucursal }
    : zero();

  const from = anchor ? anchor.ym : '0000-00';
  const rows = db.prepare(`
    SELECT type, account, to_account, amount
    FROM cuentas_transactions
    WHERE congregation_id = ? AND substr(date,1,7) >= ? AND substr(date,1,7) < ?
    ORDER BY date ASC, created_at ASC
  `).all(congreId, from, ym) as Transaction[];

  for (const tx of rows) apply(b, tx);
  for (const k of ACCOUNTS) b[k] = round2(b[k]);
  return b;
}

/**
 * Saldo de apertura del mes. Si hay fila explícita en `cuentas_saldo_inicial`
 * se respeta tal cual (el usuario la editó); si no, se usa el arrastre real.
 */
export function openingBalance(congreId: string, ym: string): Balance {
  const explicit = getDb().prepare(
    `SELECT caja, corriente, sucursal FROM cuentas_saldo_inicial
     WHERE congregation_id = ? AND ym = ?`
  ).get(congreId, ym) as Balance | undefined;

  if (explicit) {
    return { caja: explicit.caja, corriente: explicit.corriente, sucursal: explicit.sucursal };
  }
  return carryForward(congreId, ym);
}

/**
 * Contrasta el saldo inicial declarado a mano contra el arrastre real.
 *
 * Motivo: en el programa legacy el saldo inicial es editable y NO se valida.
 * En los datos reales de producción (julio 2026) el saldo inicial estaba fijado
 * a 2511 mientras el arrastre real de junio era 72 — una diferencia de 2439 que
 * hacía que el S-30 informara fondos finales de 7231 y las tarjetas de saldo
 * 4792 en la misma pantalla, sin aviso alguno. Aquí el descuadre se hace
 * explícito en vez de silencioso.
 */
export function openingAudit(congreId: string, ym: string): {
  declared: Balance | null;
  carried: Balance;
  diff: Balance;
  diffTotal: number;
  matches: boolean;
} {
  const declared = getDb().prepare(
    `SELECT caja, corriente, sucursal FROM cuentas_saldo_inicial
     WHERE congregation_id = ? AND ym = ?`
  ).get(congreId, ym) as Balance | undefined;

  const carried = carryForward(congreId, ym);

  if (!declared) {
    return { declared: null, carried, diff: zero(), diffTotal: 0, matches: true };
  }

  const d: Balance = {
    caja:      round2(declared.caja      - carried.caja),
    corriente: round2(declared.corriente - carried.corriente),
    sucursal:  round2(declared.sucursal  - carried.sucursal),
  };
  const diffTotal = totalOf(d);

  return {
    declared: { caja: declared.caja, corriente: declared.corriente, sucursal: declared.sucursal },
    carried,
    diff: d,
    diffTotal,
    matches: Math.abs(diffTotal) < 0.01,
  };
}

/* ── S-26: Hoja de cuentas ──────────────────────────────────────────────────── */

export interface S26Row extends Transaction {
  /** Montos por columna del grid: [cuenta][entrada|salida] */
  cols: Record<Account, { in: number; out: number }>;
  /** Total acumulado de las 3 cuentas después de esta fila. */
  saldo: number;
}

export interface S26 {
  ym: string;
  monthLabel: string;
  opening: Balance;
  openingTotal: number;
  rows: S26Row[];
  /** Totales por columna, como la fila "TOTALES DE TODAS LAS COLUMNAS". */
  totals: Record<Account, { in: number; out: number }>;
  closing: Balance;
  closingTotal: number;
  /** Contraste del saldo inicial declarado contra el arrastre real. */
  openingAudit: ReturnType<typeof openingAudit>;
}

export function buildS26(congreId: string, ym: string): S26 {
  const opening = openingBalance(congreId, ym);
  const running: Balance = { ...opening };
  const totals: Record<Account, { in: number; out: number }> = {
    caja: { in: 0, out: 0 }, corriente: { in: 0, out: 0 }, sucursal: { in: 0, out: 0 },
  };

  const rows: S26Row[] = txOfMonth(congreId, ym).map(tx => {
    const cols: Record<Account, { in: number; out: number }> = {
      caja: { in: 0, out: 0 }, corriente: { in: 0, out: 0 }, sucursal: { in: 0, out: 0 },
    };

    if (tx.type === 'income') {
      cols[tx.account].in = tx.amount;
    } else if (tx.type === 'expense') {
      cols[tx.account].out = tx.amount;
    } else if (tx.type === 'transfer' && tx.to_account) {
      // Una sola fila ocupa dos columnas: sale de una cuenta, entra en otra.
      cols[tx.account].out = tx.amount;
      cols[tx.to_account].in = tx.amount;
    }

    for (const a of ACCOUNTS) {
      totals[a].in  = round2(totals[a].in  + cols[a].in);
      totals[a].out = round2(totals[a].out + cols[a].out);
    }

    apply(running, tx);
    return { ...tx, cols, saldo: totalOf(running) };
  });

  const closing: Balance = { ...running };
  for (const a of ACCOUNTS) closing[a] = round2(closing[a]);

  return {
    ym,
    monthLabel: monthLabel(ym),
    opening,
    openingTotal: totalOf(opening),
    rows,
    totals,
    closing,
    closingTotal: totalOf(closing),
    openingAudit: openingAudit(congreId, ym),
  };
}

/* ── S-30: Informe mensual ──────────────────────────────────────────────────── */

export interface CodeTotal { code: string; description: string; total: number }

export interface S30 {
  ym: string;
  monthLabel: string;
  serviceYear: string;
  /** (a) Fondos a comienzo de mes */
  a: number;
  /** (b) Total recibido para la congregación */
  b: number;
  incomeByCode: CodeTotal[];
  /** (c) Total de gastos de la congregación */
  c: number;
  expenseByCode: CodeTotal[];
  /** (d) Sobrante / déficit = b − c */
  d: number;
  /** (e) Fondos a fin de mes = a + d */
  e: number;
  /** (f) Fondos reservados para propósitos especiales */
  f: number;
  box_kingdom: number;
  other_reserves: number;
  /** (g) Fondos disponibles = e − f */
  g: number;
  /** (h) = a */
  h: number;
  /** (i) Recibido */
  i: number;
  /** (j) Desembolsos */
  j: number;
  /** (k) = h + i − j; debe coincidir con (e) */
  k: number;
  /** Guard visible: la conciliación cuadra. */
  reconciled: boolean;
  box_worldwide: number;
  movements: { account: Account; label: string; previous: number; income: number; expense: number; current: number }[];
}

function codeDescriptions(congreId: string): Map<string, string> {
  const rows = getDb().prepare(
    `SELECT code, description FROM cuentas_codes WHERE congregation_id = ?`
  ).all(congreId) as { code: string; description: string }[];
  const m = new Map(rows.map(r => [r.code, r.description]));
  for (const d of DEFAULT_CODES) if (!m.has(d.code)) m.set(d.code, d.description);
  return m;
}

function groupByCode(txs: Transaction[], descs: Map<string, string>): CodeTotal[] {
  const acc = new Map<string, number>();
  for (const t of txs) {
    const c = t.code || '—';
    acc.set(c, round2((acc.get(c) ?? 0) + t.amount));
  }
  return [...acc.entries()]
    .map(([code, total]) => ({ code, description: descs.get(code) ?? code, total }))
    .sort((x, y) => x.code.localeCompare(y.code));
}

export function buildS30(congreId: string, ym: string): S30 {
  const descs = codeDescriptions(congreId);
  const opening = openingBalance(congreId, ym);
  const txs = txOfMonth(congreId, ym);

  const incomes  = txs.filter(t => t.type === 'income');
  const expenses = txs.filter(t => t.type === 'expense');

  const a = totalOf(opening);
  const b = round2(incomes.reduce((s, t) => s + t.amount, 0));
  const c = round2(expenses.reduce((s, t) => s + t.amount, 0));
  const d = round2(b - c);
  const e = round2(a + d);

  const box_kingdom   = round2(incomes.filter(t => t.code === KINGDOM_BOX_CODE).reduce((s, t) => s + t.amount, 0));
  const box_worldwide = round2(incomes.filter(t => t.code === WORLDWIDE_BOX_CODE).reduce((s, t) => s + t.amount, 0));
  const other_reserves = 0;
  const f = round2(box_kingdom + other_reserves);
  const g = round2(e - f);

  // Conciliación (página 2): mismos números por otra vía.
  const h = a;
  const i = b;
  const j = c;
  const k = round2(h + i - j);

  // Movimientos por cuenta: las transferencias sí mueven cuentas individuales.
  const closing: Balance = { ...opening };
  for (const t of txs) apply(closing, t);

  const movements = ACCOUNTS.map(account => {
    let income = 0, expense = 0;
    for (const t of txs) {
      if (t.type === 'income'   && t.account === account) income  += t.amount;
      if (t.type === 'expense'  && t.account === account) expense += t.amount;
      if (t.type === 'transfer') {
        if (t.account === account)    expense += t.amount;
        if (t.to_account === account) income  += t.amount;
      }
    }
    return {
      account,
      label: ACCOUNT_LABELS[account],
      previous: round2(opening[account]),
      income: round2(income),
      expense: round2(expense),
      current: round2(closing[account]),
    };
  });

  return {
    ym, monthLabel: monthLabel(ym), serviceYear: serviceYearOf(ym),
    a, b, incomeByCode: groupByCode(incomes, descs),
    c, expenseByCode: groupByCode(expenses, descs),
    d, e, f, box_kingdom, other_reserves, g,
    h, i, j, k,
    reconciled: Math.abs(k - e) < 0.01,
    box_worldwide,
    movements,
  };
}

/* ── S-25c: Auditoría trimestral ────────────────────────────────────────────── */

export interface S25cMonth {
  ym: string;
  label: string;
  income: number;
  expense: number;
  omIncome: number;
  omRemit: number;
}

export interface S25c {
  serviceYear: string;
  quarter: number;
  quarterLabel: string;
  months: S25cMonth[];
  totals: { income: number; expense: number; omIncome: number; omRemit: number };
  openingFunds: number;
  closingFunds: number;
  /** Fondos finales = Fondos iniciales + Ingresos − Gastos */
  reconciled: boolean;
}

export function buildS25c(congreId: string, sy: string, quarter: number): S25c {
  const q = QUARTERS.find(x => x.n === quarter) ?? QUARTERS[0];
  const all = serviceYearMonths(sy);
  const yms = q.offsets.map(o => all[o]);

  const months: S25cMonth[] = yms.map(ym => {
    const txs = txOfMonth(congreId, ym);
    const incomes  = txs.filter(t => t.type === 'income');
    const expenses = txs.filter(t => t.type === 'expense');
    return {
      ym,
      label: monthLabel(ym),
      income:   round2(incomes.reduce((s, t) => s + t.amount, 0)),
      expense:  round2(expenses.reduce((s, t) => s + t.amount, 0)),
      omIncome: round2(incomes.filter(t => t.code && (OM_INCOME_CODES as readonly string[]).includes(t.code)).reduce((s, t) => s + t.amount, 0)),
      omRemit:  round2(expenses.filter(t => t.code && (OM_REMIT_CODES as readonly string[]).includes(t.code)).reduce((s, t) => s + t.amount, 0)),
    };
  });

  const totals = {
    income:   round2(months.reduce((s, m) => s + m.income, 0)),
    expense:  round2(months.reduce((s, m) => s + m.expense, 0)),
    omIncome: round2(months.reduce((s, m) => s + m.omIncome, 0)),
    omRemit:  round2(months.reduce((s, m) => s + m.omRemit, 0)),
  };

  const openingFunds = totalOf(openingBalance(congreId, yms[0]));
  const lastS26 = buildS26(congreId, yms[2]);
  const closingFunds = lastS26.closingTotal;

  return {
    serviceYear: sy, quarter: q.n, quarterLabel: q.label,
    months, totals, openingFunds, closingFunds,
    reconciled: Math.abs(openingFunds + totals.income - totals.expense - closingFunds) < 0.01,
  };
}

/* ── Relación I/E: resumen del año de servicio ──────────────────────────────── */

export interface SummaryMonth { ym: string; label: string; short: string; income: number; expense: number; net: number }

export function buildSummary(congreId: string, sy: string): { serviceYear: string; months: SummaryMonth[]; totals: { income: number; expense: number; net: number } } {
  const months = serviceYearMonths(sy).map(ym => {
    const txs = txOfMonth(congreId, ym);
    const income  = round2(txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
    const expense = round2(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    const [, m] = ym.split('-').map(Number);
    return { ym, label: monthLabel(ym), short: MONTH_NAMES_ES[m - 1].slice(0, 3), income, expense, net: round2(income - expense) };
  });
  return {
    serviceYear: sy,
    months,
    totals: {
      income:  round2(months.reduce((s, m) => s + m.income, 0)),
      expense: round2(months.reduce((s, m) => s + m.expense, 0)),
      net:     round2(months.reduce((s, m) => s + m.net, 0)),
    },
  };
}

/* ── Análisis contables (conciliación) ──────────────────────────────────────── */

export interface Check { label: string; ok: boolean; detail: string }

export function buildReconcile(congreId: string, ym: string): { ym: string; monthLabel: string; checks: Check[]; allOk: boolean } {
  const s26 = buildS26(congreId, ym);
  const s30 = buildS30(congreId, ym);
  const txs = txOfMonth(congreId, ym);
  const money = (n: number) => `$${n.toFixed(2)}`;

  const checks: Check[] = [];

  checks.push({
    label: 'Conciliación S-30: (k) = (e)',
    ok: s30.reconciled,
    detail: `(k) ${money(s30.k)} vs (e) ${money(s30.e)}`,
  });

  const colNet = round2(ACCOUNTS.reduce((s, a) => s + s26.totals[a].in - s26.totals[a].out, 0));
  checks.push({
    label: 'Totales de columna cuadran con el movimiento del mes',
    ok: Math.abs(colNet - s30.d) < 0.01,
    detail: `Neto de columnas ${money(colNet)} vs sobrante/déficit ${money(s30.d)}`,
  });

  checks.push({
    label: 'Saldo final = saldo inicial + movimiento',
    ok: Math.abs(s26.closingTotal - (s26.openingTotal + s30.d)) < 0.01,
    detail: `${money(s26.closingTotal)} vs ${money(round2(s26.openingTotal + s30.d))}`,
  });

  const badTransfers = txs.filter(t => t.type === 'transfer' && (!t.to_account || t.to_account === t.account));
  checks.push({
    label: 'Todas las transferencias tienen cuenta destino distinta',
    ok: badTransfers.length === 0,
    detail: badTransfers.length ? `${badTransfers.length} transferencia(s) inválida(s)` : 'Sin incidencias',
  });

  const noCode = txs.filter(t => !t.code);
  checks.push({
    label: 'Todas las transacciones tienen código CT',
    ok: noCode.length === 0,
    detail: noCode.length ? `${noCode.length} sin código` : 'Sin incidencias',
  });

  const negative = ACCOUNTS.filter(a => a !== 'caja' && s26.closing[a] < -0.01);
  checks.push({
    label: 'Cuenta Principal y Secundaria no quedan en negativo',
    ok: negative.length === 0,
    detail: negative.length
      ? negative.map(a => `${ACCOUNT_LABELS[a]}: ${money(s26.closing[a])}`).join(' · ')
      : 'Sin incidencias',
  });

  const oa = s26.openingAudit;
  checks.push({
    label: 'Saldo inicial declarado coincide con el arrastre real',
    ok: oa.matches,
    detail: oa.declared === null
      ? 'Sin saldo inicial declarado — se usa el arrastre'
      : oa.matches
        ? `Declarado y arrastrado coinciden (${money(totalOf(oa.carried))})`
        : `Declarado ${money(totalOf(oa.declared))} vs arrastrado ${money(totalOf(oa.carried))} · diferencia ${money(oa.diffTotal)}`,
  });

  const omPending = round2(s25cOmPending(congreId, ym));
  checks.push({
    label: 'Donaciones de obra mundial remesadas',
    ok: Math.abs(omPending) < 0.01,
    detail: omPending > 0
      ? `Pendiente de remesar: ${money(omPending)}`
      : 'Al corriente',
  });

  return { ym, monthLabel: monthLabel(ym), checks, allOk: checks.every(c => c.ok) };
}

/** Donaciones OM recibidas en el mes menos remesas enviadas en el mes. */
export function s25cOmPending(congreId: string, ym: string): number {
  const txs = txOfMonth(congreId, ym);
  const rec = txs.filter(t => t.type === 'income'  && t.code && (OM_INCOME_CODES as readonly string[]).includes(t.code))
                 .reduce((s, t) => s + t.amount, 0);
  const rem = txs.filter(t => t.type === 'expense' && t.code && (OM_REMIT_CODES as readonly string[]).includes(t.code))
                 .reduce((s, t) => s + t.amount, 0);
  return round2(rec - rem);
}

export { round2, zero, prevYm, txOfMonth, txBefore };
