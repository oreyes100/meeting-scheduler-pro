/**
 * Relleno de los formularios oficiales S-30-S y S-25c. SOLO SERVIDOR.
 *
 * Los PDF que publica la organización son AcroForm con campos nombrados
 * (`900_1_Text`, `901_6_S30_Total`…). Rellenarlos da un documento idéntico al
 * que espera la sucursal; recrear el diseño en HTML nunca lo consigue.
 *
 * ── Sobre el mapa de campos ─────────────────────────────────────────────────
 * Los nombres son correlativos y no describen su contenido, y las plantillas
 * llegaron en blanco, así que la correspondencia campo→dato no puede deducirse
 * del archivo. En vez de adivinar en silencio, el mapa de abajo es explícito y
 * editable, y existe un MODO CALIBRACIÓN (`calibrate: true`) que rellena cada
 * casilla con su propio nombre: se imprime una vez, se ve qué casilla es cuál y
 * se corrigen aquí las que no coincidan. Cinco minutos, y queda fijado.
 */
import fs from 'fs';
import path from 'path';
import type { S26, S30, S25c } from './cuentas';

/**
 * Tipos mínimos de pdf-lib. Se declaran aquí y el paquete se carga de forma
 * diferida para que el proyecto compile aunque la dependencia no esté instalada
 * todavía: el resto del módulo Cuentas sigue funcionando y solo esta ruta avisa.
 */
interface PDFTextField { setText(v: string): void; setFontSize(n: number): void }
interface PDFField { getName(): string }
interface PDFForm {
  getTextField(name: string): PDFTextField;
  getFields(): PDFField[];
  updateFieldAppearances?(): void;
}
interface PDFDoc { getForm(): PDFForm; save(): Promise<Uint8Array> }

async function loadPdfLib(): Promise<{ PDFDocument: { load(b: Buffer): Promise<PDFDoc> } }> {
  // Especificador en variable: evita que TypeScript exija los tipos del paquete
  // en tiempo de compilación. La ruta devuelve un 501 explicable si no está.
  const mod = 'pdf-lib';
  return import(/* webpackIgnore: false */ mod) as unknown as Promise<{ PDFDocument: { load(b: Buffer): Promise<PDFDoc> } }>;
}
import { monthLabel, ACCOUNTS, type Account } from './cuentasDomain';

const TEMPLATES = path.join(process.cwd(), 'src', 'lib', 'pdf-templates');

export type FormKind = 's26' | 's30' | 's25c';

const TEMPLATE_FILE: Record<FormKind, string> = {
  s26:  'S-26-S.pdf',
  s30:  'S-30-S.pdf',
  s25c: 'S-25c-S.pdf',
};

export function templateExists(kind: FormKind): boolean {
  return fs.existsSync(path.join(TEMPLATES, TEMPLATE_FILE[kind]));
}

/** Importe tal como lo escribe el formulario oficial: sin símbolo, dos decimales. */
const amt = (n: number | null | undefined) =>
  n == null || n === 0 ? '' : n.toFixed(2);

/* ── Mapa S-30-S ────────────────────────────────────────────────────────────
 * Resuelto con el PDF de calibración: los números impresos son la posición del
 * campo en la lista alfabética, y al traducirlos salió esta correspondencia.
 *
 * OJO con las letras: las del formulario oficial NO coinciden con las que usa
 * el motor interno.
 *   oficial (a) fondos al inicio      = a
 *   oficial (b) recibido congregación = donaciones C/DC/DB/DE
 *   oficial (c) otros ingresos        = obra mundial y demás
 *   oficial (d) total de ingresos     = b del motor
 *   oficial (e) gastos congregación   = gastos sin remesas
 *   oficial (f) otros desembolsos     = remesas a la sucursal
 *   oficial (g) total desembolsos     = c del motor
 *   oficial (h) superávit / déficit   = d del motor
 *   oficial (i) fondos al final       = e del motor
 *   oficial (j) reservados            = f del motor
 *   oficial (k) disponibles           = g del motor
 */
function mapS30(s30: S30, header: { label: string; city: string; state: string }) {
  const inc = (...codes: string[]) =>
    codes.reduce((t, c) => t + (s30.incomeByCode.find(r => r.code === c)?.total ?? 0), 0);
  const exp = (...codes: string[]) =>
    codes.reduce((t, c) => t + (s30.expenseByCode.find(r => r.code === c)?.total ?? 0), 0);

  // INGRESOS
  const cajas       = inc('C', 'DC');
  const electronica = inc('DB', 'DE');
  const recibidoCongre = cajas + electronica;
  const obraMundial = inc('OM', 'DO');
  const otrosIngresos = Math.round((s30.b - recibidoCongre) * 100) / 100;

  // DESEMBOLSOS
  const gastosSalon  = exp('GL', 'GM');
  const resolucion   = exp('RM');
  const oradorVisit  = exp('OV');
  const otrosGastos  = exp('G', 'GA', 'GC', 'GS', 'OT');
  const gastosCongre = gastosSalon + resolucion + oradorVisit + otrosGastos;
  const remesas      = exp('SOM', 'RE', 'ROM');

  const money = (n: number) => amt(Math.round(n * 100) / 100);

  return {
    '900_1_Text': header.label,
    '900_2_Text': monthLabel(s30.ym),

    // (a) Fondos al comienzo del mes
    '901_1_S30_Value': money(s30.a),

    // RECIBIDO PARA LA CONGREGACIÓN
    '901_2_S30_Value': money(cajas),
    '901_3_S30_Value': money(electronica),
    '901_6_S30_Total': money(recibidoCongre),          // (b)

    // OTROS INGRESOS
    '901_7_S30_Value':  money(obraMundial),
    '901_10_S30_Total': money(otrosIngresos),          // (c)
    '901_11_S30_Total': money(s30.b),                  // (d) total de ingresos

    // GASTOS DE LA CONGREGACIÓN — la etiqueta de cada línea libre va en 900_*
    // y su importe en el 901_* de la MISMA fila; separarlos dejaba la cifra
    // huérfana y el concepto sin cantidad.
    '901_12_S30_Value': money(gastosSalon),
    '901_13_S30_Value': money(resolucion),
    '900_7_Text':       oradorVisit > 0 ? 'Orador visitante / discursante (OV)' : '',
    '901_14_S30_Value': money(oradorVisit),
    '900_8_Text':       otrosGastos > 0 ? 'Otros gastos de la congregación' : '',
    '901_15_S30_Value': money(otrosGastos),
    '901_19_S30_Total': money(gastosCongre),           // (e)

    // OTROS DESEMBOLSOS
    '901_20_S30_Value': money(remesas),
    '901_23_S30_Total': money(remesas),                // (f)

    '901_24_S30_Total': money(s30.c),                  // (g) total desembolsos
    '901_25_S30_Total': money(s30.d),                  // (h) superávit / déficit
    '901_26_S30_Total': money(s30.e),                  // (i) fondos al final

    // FONDOS RESERVADOS
    '900_14_Text':      s30.box_kingdom > 0 ? 'Contribuciones para Salones del Reino (DK)' : '',
    '901_27_S30_Value': money(s30.box_kingdom),
    '901_29_S30_Total': money(s30.f),                  // (j)
    '901_30_S30_Total': money(s30.g),                  // (k) disponibles

    // Página 2 — anuncio que se lee a la congregación
    '900_17_Text_C':    monthLabel(s30.ym),
    '901_31_S30_Total': money(recibidoCongre),         // cantidad (b)
    '901_32_S30_Total': money(gastosCongre),           // cantidad (e)
    '901_33_S30_Total': money(s30.e),                  // cantidad (i)
    '901_34_S30_Total': money(remesas),                // cantidad (f)
  } as Record<string, string>;
}

/* ── Mapa S-25c ─────────────────────────────────────────────────────────────
 * Formulario de auditoría trimestral: encabezado, fechas y los datos del
 * sistema que el auditor coteja.
 */
function mapS25c(s25c: S25c, header: { label: string; city: string; state: string }) {
  const m = s25c.months;
  return {
    '900_1_Text':  header.label,
    '900_9_Text':  m[0]?.label ?? '',
    '900_10_Text': m[2]?.label ?? '',
    '900_11_Text': new Date().toLocaleDateString('es-MX'),

    // Datos del sistema por mes: recibido y desembolsos
    '900_12_Text_C': amt(m[0]?.income),
    '900_13_Text_C': amt(m[1]?.income),
    '900_14_Text_C': amt(m[2]?.income),
    '900_15_Text_C': amt(m[0]?.expense),
    '900_16_Text_C': amt(m[1]?.expense),
    '900_17_Text_C': amt(m[2]?.expense),

    // Obra mundial recibida y remesada en el trimestre
    '900_18_Text_C': amt(s25c.totals.omIncome),
    '900_19_Text_C': amt(s25c.totals.omRemit),

    // Fondos al inicio y al final del trimestre
    '900_23_Text_C': amt(s25c.openingFunds),
    '900_24_Text_C': amt(s25c.closingFunds),
  } as Record<string, string>;
}

/* ── Mapa S-26-S ────────────────────────────────────────────────────────────
 * La hoja de cuentas tiene 533 campos en cuatro bloques (900_ a 904_): la
 * rejilla de asientos ocupa la mayoría y la página 2 lleva la conciliación.
 * Aquí van el encabezado y los totales, que son los que se pueden fijar sin
 * ambigüedad. La correspondencia fila→campo de la rejilla se establece con el
 * modo calibración: imprime el PDF con cada casilla rotulada, y con esa
 * referencia se completa ROW_FIELDS de abajo.
 */
/**
 * Rejilla del S-26, deducida de la numeración de los campos.
 *
 * El formulario tiene 53 filas. Las 52 primeras son asientos y la 53 es la de
 * totales. La correspondencia se obtuvo contrastando las coordenadas de los
 * widgets con una impresión real:
 *
 *   fila N   fecha        900_(6+N)_Text_C      → 900_7 … 900_58
 *            descripción  900_(58+N)_Text       → 900_59 … 900_110
 *            código CT    900_(110+N)_Text_C    → 900_111 … 900_162
 *            importes     90{1,2,3}_N (entrada) y 90{1,2,3}_(N+53) (salida)
 *
 * Confirmado con un PDF de calibración impreso: los números que muestra cada
 * casilla son la posición del campo en la lista ordenada alfabéticamente, y al
 * resolverlos salió que la primera fila usa 900_7 / 900_59 / 900_111.
 * Los totales de columna usan el índice 53 de cada bloque.
 */
const S26_ROWS = 52;
const S26_TOTALS_INDEX = 53;

function s26RowFields(n: number) {           // n es 1-based
  return {
    date: `900_${6 + n}_Text_C`,
    desc: `900_${58 + n}_Text`,
    code: `900_${110 + n}_Text_C`,
    cols: {
      caja:      { in: `901_${n}_S26Value`, out: `901_${n + 53}_S26Value` },
      corriente: { in: `902_${n}_S26Value`, out: `902_${n + 53}_S26Value` },
      sucursal:  { in: `903_${n}_S26Value`, out: `903_${n + 53}_S26Value` },
    } as Record<Account, { in: string; out: string }>,
  };
}

function mapS26(s26: S26, header: { label: string; city: string; state: string }) {
  const out: Record<string, string> = {
    '900_1_Text_C': header.label,
    '900_2_Text_C': header.city,
    '900_3_Text_C': header.state,
    '900_4_Text_C': s26.monthLabel,
  };

  // Primera línea: el saldo inicial del mes, como en la hoja del programa anterior.
  const first = s26RowFields(1);
  out[first.desc] = `SALDO INICIAL DEL MES — ${s26.openingTotal.toFixed(2)}`;

  s26.rows.slice(0, S26_ROWS - 1).forEach((r, i) => {
    const f = s26RowFields(i + 2);          // la fila 1 la ocupa el saldo inicial
    out[f.date] = String(Number(r.date.slice(8, 10)));
    out[f.desc] = r.description;
    out[f.code] = r.code ?? '';
    for (const a of ACCOUNTS) {
      out[f.cols[a].in]  = amt(r.cols[a].in);
      out[f.cols[a].out] = amt(r.cols[a].out);
    }
  });

  // Fila de totales de todas las columnas.
  const t = S26_TOTALS_INDEX;
  out[`900_${58 + t}_Text`] = 'TOTALES DE TODAS LAS COLUMNAS';
  const blocks: Record<Account, string> = { caja: '901', corriente: '902', sucursal: '903' };
  for (const a of ACCOUNTS) {
    out[`${blocks[a]}_${t}_S26Value`]      = amt(s26.totals[a].in);
    out[`${blocks[a]}_${t + 53}_S26Value`] = amt(s26.totals[a].out);
  }

  // Página 2 — resumen de la hoja de cuentas.
  out['904_44_S26Amount']      = amt(s26.opening.caja);
  out['904_45_S26Amount']      = amt(s26.totals.caja.in);
  out['904_46_S26Amount']      = amt(s26.totals.caja.out);
  out['904_47_S26TotalAmount'] = amt(s26.closing.caja);
  out['904_49_S26Amount']      = amt(s26.opening.corriente);
  out['904_51_S26Amount']      = amt(s26.totals.corriente.in);
  out['904_53_S26Amount']      = amt(s26.totals.corriente.out);
  out['904_54_S26TotalAmount'] = amt(s26.closing.corriente);
  out['904_55_S26Amount']      = amt(s26.closing.sucursal);
  out['904_56_S26TotalAmount'] = amt(s26.closingTotal);

  return out;
}

export async function fillS26(
  s26: S26,
  header: { label: string; city: string; state: string },
  opts: FillOptions = {},
): Promise<Uint8Array> {
  return fill('s26', mapS26(s26, header), opts);
}

/** Valores que se escribirían, para verificar el mapa sin abrir el PDF. */
export function previewValues(
  kind: FormKind,
  data: { s26?: S26; s30?: S30; s25c?: S25c },
  header: { label: string; city: string; state: string },
): Record<string, string> {
  if (kind === 's26'  && data.s26)  return mapS26(data.s26, header);
  if (kind === 's30'  && data.s30)  return mapS30(data.s30, header);
  if (kind === 's25c' && data.s25c) return mapS25c(data.s25c, header);
  return {};
}

/* ── Relleno ────────────────────────────────────────────────────────────────── */

function setField(form: PDFForm, name: string, value: string, size = 8) {
  try {
    const f = form.getTextField(name);
    f.setText(value);
    // Sin tamaño explícito, pdf-lib usa el automático y el texto sale enorme:
    // los campos del encabezado son altos y el ajuste automático los llena.
    try { f.setFontSize(size); } catch { /* campo sin tipografía propia */ }
  } catch {
    // Campo inexistente o de otro tipo (casilla de verificación): se ignora.
  }
}

/** Correspondencia número→campo de la última calibración generada. */
export let calibrationLegend: string[] = [];

export interface FillOptions {
  /** Rellena cada casilla con su propio nombre, para ajustar el mapa. */
  calibrate?: boolean;
}

export async function fillS30(
  s30: S30,
  header: { label: string; city: string; state: string },
  opts: FillOptions = {},
): Promise<Uint8Array> {
  return fill('s30', mapS30(s30, header), opts);
}

export async function fillS25c(
  s25c: S25c,
  header: { label: string; city: string; state: string },
  opts: FillOptions = {},
): Promise<Uint8Array> {
  return fill('s25c', mapS25c(s25c, header), opts);
}

async function fill(
  kind: FormKind, values: Record<string, string>, opts: FillOptions,
): Promise<Uint8Array> {
  const file = path.join(TEMPLATES, TEMPLATE_FILE[kind]);
  if (!fs.existsSync(file)) {
    throw new Error(`Falta la plantilla oficial ${TEMPLATE_FILE[kind]} en src/lib/pdf-templates/`);
  }

  const { PDFDocument } = await loadPdfLib();
  const pdf = await PDFDocument.load(fs.readFileSync(file));
  const form = pdf.getForm();

  // La plantilla puede traer valores previos —la del S-25c llegó con una
  // auditoría de ejemplo rellena—, y lo que no se sobrescriba se imprimiría como
  // si fuera de esta congregación. Se vacían todos los campos primero.
  for (const f of form.getFields()) setField(form, f.getName(), '');

  if (opts.calibrate) {
    // Cada casilla lleva un número correlativo, no el nombre interno del campo:
    // el nombre no dice nada a quien mira el formulario impreso. Con el número
    // basta para señalar «la casilla 37 debería llevar el total de ingresos».
    const names = form.getFields().map(f => f.getName()).sort();
    names.forEach((n, i) => setField(form, n, String(i + 1), 6));
    calibrationLegend = names.map((n, i) => `${i + 1} = ${n}`);
  } else {
    for (const [name, value] of Object.entries(values)) {
      if (value !== '') setField(form, name, value);
    }
  }

  // Deja el PDF editable: el siervo de cuentas suele completar a mano las
  // preguntas de la auditoría y las líneas que el sistema no conoce.
  form.updateFieldAppearances?.();
  return pdf.save();
}

/** Nombres de todos los campos de una plantilla, para depuración. */
export async function listFields(kind: FormKind): Promise<string[]> {
  const file = path.join(TEMPLATES, TEMPLATE_FILE[kind]);
  const { PDFDocument } = await loadPdfLib();
  const pdf = await PDFDocument.load(fs.readFileSync(file));
  return pdf.getForm().getFields().map(f => f.getName());
}
