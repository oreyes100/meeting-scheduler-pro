/**
 * Importación del respaldo CSV del programa de contabilidad legacy.
 *
 * El export del legacy no tiene un formato documentado, así que aquí no se
 * asume: se detectan las columnas por nombre y el usuario puede corregir el
 * mapeo antes de importar. Nada se escribe sin una pasada de validación previa.
 */

// Importa del dominio puro, NO de `cuentas.ts`: este módulo corre también en el
// navegador (ImportPanel analiza el CSV antes de enviarlo) y `cuentas.ts`
// arrastra better-sqlite3.
import { ACCOUNTS, TYPES, type Account, type TxType } from './cuentasDomain';

/* ── Parser CSV (comillas, comas y saltos dentro de campo) ──────────────────── */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // BOM de Excel
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  // Delimitador: se elige el más frecuente en la primera línea.
  const firstLine = s.split(/\r?\n/)[0] ?? '';
  const delim = [',', ';', '\t']
    .map(d => ({ d, n: firstLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }

    if (c === '"') { inQuotes = true; continue; }
    if (c === delim) { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }

  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

/* ── Mapeo de columnas ──────────────────────────────────────────────────────── */

export type Field =
  | 'date' | 'type' | 'account' | 'to_account' | 'code'
  | 'description' | 'amount' | 'receipt_ref' | 'notes' | 'ignore';

export const FIELD_LABELS: Record<Field, string> = {
  date:        'Fecha',
  type:        'Tipo (entrada/salida/transferencia)',
  account:     'Cuenta',
  to_account:  'Cuenta destino',
  code:        'Código CT',
  description: 'Descripción',
  amount:      'Monto',
  receipt_ref: 'Comprobante',
  notes:       'Notas',
  ignore:      '— ignorar —',
};

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Nombres de columna conocidos, por campo. */
const ALIASES: Record<Exclude<Field, 'ignore'>, string[]> = {
  date:        ['fecha', 'date', 'fecha_transaccion', 'dia'],
  type:        ['tipo', 'type', 'movimiento'],
  account:     ['cuenta', 'account', 'cuenta_origen', 'origen'],
  to_account:  ['cuenta_destino', 'to_account', 'destino', 'cuentadestino'],
  code:        ['ct', 'codigo', 'code', 'codigo_ct', 'ct_code', 'clave'],
  description: ['descripcion', 'description', 'concepto', 'detalle', 'descripcion de transaccion'],
  amount:      ['monto', 'amount', 'importe', 'cantidad', 'valor'],
  receipt_ref: ['recibo', 'comprobante', 'receipt', 'receipt_ref', 'folio', 'referencia'],
  notes:       ['notas', 'notes', 'observaciones', 'nota', 'comentario'],
};

export function autoMap(headers: string[]): Field[] {
  const used = new Set<Field>();
  return headers.map(h => {
    const n = norm(h).replace(/\s+/g, '_');
    for (const [field, names] of Object.entries(ALIASES) as [Exclude<Field, 'ignore'>, string[]][]) {
      if (used.has(field)) continue;
      if (names.some(a => n === a || n.replace(/_/g, ' ') === a)) { used.add(field); return field; }
    }
    return 'ignore' as Field;
  });
}

/* ── Normalización de valores ───────────────────────────────────────────────── */

/** Acepta los enums internos y también las etiquetas en español del legacy. */
function normType(raw: string): TxType | null {
  const n = norm(raw);
  if ((TYPES as readonly string[]).includes(n)) return n as TxType;
  if (['entrada', 'ingreso', 'ingresos', 'in'].includes(n)) return 'income';
  if (['salida', 'gasto', 'gastos', 'egreso', 'egresos', 'out'].includes(n)) return 'expense';
  if (['transferencia', 'traspaso', 'transfer'].includes(n)) return 'transfer';
  return null;
}

function normAccount(raw: string): Account | null {
  const n = norm(raw);
  if ((ACCOUNTS as readonly string[]).includes(n)) return n as Account;
  if (['recibido', 'donaciones', 'recibido (donaciones)'].includes(n)) return 'caja';
  if (['principal', 'cuenta principal', 'caja de dinero', 'caja de efectivo'].includes(n)) return 'corriente';
  if (['secundaria', 'cuenta secundaria', 'banco'].includes(n)) return 'sucursal';
  return null;
}

/** Acepta 1234.56 · 1,234.56 · 1.234,56 · $1,234.56 · (123) como negativo. */
function normAmount(raw: string): number | null {
  let s = raw.replace(/[$\s]/g, '').trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');  // 1.234,56
  else s = s.replace(/,/g, '');                                         // 1,234.56

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Acepta YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY (ambiguo → día primero) y DD-MM-YYYY. */
function normDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, a, b, y] = m;
    let day = Number(a), month = Number(b);
    // Si el primer número no puede ser día, se invierte.
    if (day > 12 && month <= 12) { /* día primero, correcto */ }
    else if (month > 12 && day <= 12) { [day, month] = [month, day]; }
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

/* ── Validación fila a fila ─────────────────────────────────────────────────── */

export interface ImportRow {
  line: number;
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

export interface ImportIssue { line: number; message: string; raw: string[] }

export interface ImportPlan {
  rows: ImportRow[];
  issues: ImportIssue[];
  /** Códigos presentes en el CSV que aún no existen en el catálogo. */
  newCodes: { code: string; description: string }[];
  months: string[];
  totals: { income: number; expense: number; transfer: number };
}

export function buildPlan(
  data: string[][], mapping: Field[], hasHeader: boolean, knownCodes: Set<string>,
): ImportPlan {
  const body = hasHeader ? data.slice(1) : data;
  const idx = (f: Field) => mapping.indexOf(f);

  const iDate = idx('date'), iType = idx('type'), iAcc = idx('account'),
        iTo = idx('to_account'), iCode = idx('code'), iDesc = idx('description'),
        iAmt = idx('amount'), iRef = idx('receipt_ref'), iNotes = idx('notes');

  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  const newCodes = new Map<string, string>();
  const months = new Set<string>();
  const totals = { income: 0, expense: 0, transfer: 0 };

  body.forEach((raw, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const cell = (j: number) => (j >= 0 && j < raw.length ? String(raw[j] ?? '').trim() : '');
    const fail = (msg: string) => issues.push({ line, message: msg, raw });

    const date = normDate(cell(iDate));
    if (!date) return fail(`Fecha inválida o ausente: «${cell(iDate)}»`);

    const description = cell(iDesc);
    if (!description) return fail('Descripción vacía');

    const amountRaw = normAmount(cell(iAmt));
    if (amountRaw === null) return fail(`Monto inválido: «${cell(iAmt)}»`);

    // Un tipo ausente se deduce del signo del monto: negativo = salida.
    let type = iType >= 0 ? normType(cell(iType)) : null;
    if (!type) type = amountRaw < 0 ? 'expense' : 'income';

    const amount = Math.abs(amountRaw);
    if (amount === 0) return fail('El monto es cero');

    const account = (iAcc >= 0 ? normAccount(cell(iAcc)) : null) ?? (type === 'expense' ? 'corriente' : 'caja');

    let to_account: Account | null = null;
    if (type === 'transfer') {
      to_account = iTo >= 0 ? normAccount(cell(iTo)) : null;
      if (!to_account) return fail('Transferencia sin cuenta destino');
      if (to_account === account) return fail('La cuenta destino es igual al origen');
    }

    const code = iCode >= 0 && cell(iCode) ? cell(iCode).toUpperCase() : null;
    if (code && !knownCodes.has(code) && !newCodes.has(code)) {
      newCodes.set(code, description);
    }

    months.add(date.slice(0, 7));
    totals[type] = Math.round((totals[type] + amount) * 100) / 100;

    rows.push({
      line, date, type, account, to_account, code, description, amount,
      receipt_ref: iRef >= 0 && cell(iRef) ? cell(iRef) : null,
      notes: iNotes >= 0 && cell(iNotes) ? cell(iNotes) : null,
    });
  });

  return {
    rows, issues,
    newCodes: [...newCodes].map(([code, description]) => ({ code, description })),
    months: [...months].sort(),
    totals,
  };
}
