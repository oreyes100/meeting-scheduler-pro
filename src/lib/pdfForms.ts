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
interface PDFTextField { setText(v: string): void }
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
 * Página 1 (900_*): encabezado y etiquetas editables.
 * Página 1 (901_*): importes. `_Total` son las líneas de subtotal.
 * Verificar con el modo calibración antes de darlo por bueno.
 */
function mapS30(s30: S30, header: { label: string; city: string; state: string }) {
  const inc = (code: string) => s30.incomeByCode.find(r => r.code === code)?.total ?? 0;
  const exp = (code: string) => s30.expenseByCode.find(r => r.code === code)?.total ?? 0;

  // Recibido para la congregación: donaciones en cajas frente a electrónicas.
  const cajas       = inc('C') + inc('DC');
  const electronica = inc('DB') + inc('DE');
  // Otros ingresos: obra mundial y demás.
  const obraMundial = inc('OM') + inc('DO');
  const otrosIng    = s30.b - cajas - electronica - obraMundial;

  return {
    // Encabezado
    '900_1_Text':  header.label,
    '900_2_Text':  monthLabel(s30.ym),
    // Etiquetas de líneas libres
    '900_10_Text': 'Orador visitante / discursante (OV)',

    // (a) Fondos al comienzo del mes
    '901_1_S30_Value': amt(s30.a),

    // RECIBIDO PARA LA CONGREGACIÓN
    '901_2_S30_Value': amt(cajas),
    '901_3_S30_Value': amt(electronica),
    '901_6_S30_Total': amt(s30.b),

    // OTROS INGRESOS
    '901_7_S30_Value':  amt(obraMundial),
    '901_8_S30_Value':  amt(otrosIng > 0.005 ? otrosIng : 0),
    '901_10_S30_Total': amt(s30.b),

    // Total de ingresos
    '901_11_S30_Total': amt(s30.b),

    // GASTOS DE LA CONGREGACIÓN
    '901_12_S30_Value': amt(exp('GL') + exp('GM')),  // funcionamiento del Salón
    '901_13_S30_Value': amt(exp('RM') + exp('ROM')), // resolución mensual
    '901_14_S30_Value': amt(exp('OV')),              // orador visitante
    '901_19_S30_Total': amt(s30.c),

    // OTROS DESEMBOLSOS
    '901_20_S30_Value': amt(exp('SOM') + exp('RE')),
    '901_23_S30_Total': amt(s30.c),

    // Totales y conciliación
    '901_24_S30_Total': amt(s30.c),
    '901_25_S30_Total': amt(s30.d),
    '901_26_S30_Total': amt(s30.e),
    '901_29_S30_Total': amt(s30.box_kingdom),
    '901_30_S30_Total': amt(s30.f),
    '901_31_S30_Total': amt(s30.g),
    '901_32_S30_Total': amt(s30.h),
    '901_33_S30_Total': amt(s30.i),
    '901_34_S30_Total': amt(s30.k),
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
 * Rejilla del S-26, obtenida de las coordenadas de los widgets de la plantilla.
 *
 * Las seis columnas de importes y el código CT se dedujeron sin ambigüedad: los
 * bloques 901_/902_/903_ son Recibido/Principal/Secundaria, y dentro de cada uno
 * los índices 1-53 son «Entrada» y 54-106 «Salida» (desplazamiento de +53).
 *
 * Fecha y descripción quedan pendientes: en la plantilla solo 59 de los 160
 * campos del bloque 900_ exponen su rectángulo, y entre los que faltan están
 * esas dos columnas. Se completan con el PDF de calibración delante.
 */
const S26_ROW_FIELDS: {
  date?: string | null; desc?: string | null; code: string | null;
  cols: Record<Account, { in: string; out: string }>;
}[] = [
  { code: null, cols: { caja: { in: '901_1_S26Value', out: '901_54_S26Value' }, corriente: { in: '902_1_S26Value', out: '902_54_S26Value' }, sucursal: { in: '903_1_S26Value', out: '903_54_S26Value' } } },
  { code: '900_111_Text_C', cols: { caja: { in: '901_2_S26Value', out: '901_55_S26Value' }, corriente: { in: '902_2_S26Value', out: '902_55_S26Value' }, sucursal: { in: '903_2_S26Value', out: '903_55_S26Value' } } },
  { code: '900_112_Text_C', cols: { caja: { in: '901_3_S26Value', out: '901_56_S26Value' }, corriente: { in: '902_3_S26Value', out: '902_56_S26Value' }, sucursal: { in: '903_3_S26Value', out: '903_56_S26Value' } } },
  { code: '900_113_Text_C', cols: { caja: { in: '901_4_S26Value', out: '901_57_S26Value' }, corriente: { in: '902_4_S26Value', out: '902_57_S26Value' }, sucursal: { in: '903_4_S26Value', out: '903_57_S26Value' } } },
  { code: '900_114_Text_C', cols: { caja: { in: '901_5_S26Value', out: '901_58_S26Value' }, corriente: { in: '902_5_S26Value', out: '902_58_S26Value' }, sucursal: { in: '903_5_S26Value', out: '903_58_S26Value' } } },
  { code: '900_115_Text_C', cols: { caja: { in: '901_6_S26Value', out: '901_59_S26Value' }, corriente: { in: '902_6_S26Value', out: '902_59_S26Value' }, sucursal: { in: '903_6_S26Value', out: '903_59_S26Value' } } },
  { code: '900_116_Text_C', cols: { caja: { in: '901_7_S26Value', out: '901_60_S26Value' }, corriente: { in: '902_7_S26Value', out: '902_60_S26Value' }, sucursal: { in: '903_7_S26Value', out: '903_60_S26Value' } } },
  { code: '900_117_Text_C', cols: { caja: { in: '901_8_S26Value', out: '901_61_S26Value' }, corriente: { in: '902_8_S26Value', out: '902_61_S26Value' }, sucursal: { in: '903_8_S26Value', out: '903_61_S26Value' } } },
  { code: '900_118_Text_C', cols: { caja: { in: '901_9_S26Value', out: '901_62_S26Value' }, corriente: { in: '902_9_S26Value', out: '902_62_S26Value' }, sucursal: { in: '903_9_S26Value', out: '903_62_S26Value' } } },
  { code: '900_119_Text_C', cols: { caja: { in: '901_10_S26Value', out: '901_63_S26Value' }, corriente: { in: '902_10_S26Value', out: '902_63_S26Value' }, sucursal: { in: '903_10_S26Value', out: '903_63_S26Value' } } },
  { code: '900_120_Text_C', cols: { caja: { in: '901_11_S26Value', out: '901_64_S26Value' }, corriente: { in: '902_11_S26Value', out: '902_64_S26Value' }, sucursal: { in: '903_11_S26Value', out: '903_64_S26Value' } } },
  { code: '900_121_Text_C', cols: { caja: { in: '901_12_S26Value', out: '901_65_S26Value' }, corriente: { in: '902_12_S26Value', out: '902_65_S26Value' }, sucursal: { in: '903_12_S26Value', out: '903_65_S26Value' } } },
  { code: '900_122_Text_C', cols: { caja: { in: '901_13_S26Value', out: '901_66_S26Value' }, corriente: { in: '902_13_S26Value', out: '902_66_S26Value' }, sucursal: { in: '903_13_S26Value', out: '903_66_S26Value' } } },
  { code: '900_123_Text_C', cols: { caja: { in: '901_14_S26Value', out: '901_67_S26Value' }, corriente: { in: '902_14_S26Value', out: '902_67_S26Value' }, sucursal: { in: '903_14_S26Value', out: '903_67_S26Value' } } },
  { code: '900_124_Text_C', cols: { caja: { in: '901_15_S26Value', out: '901_68_S26Value' }, corriente: { in: '902_15_S26Value', out: '902_68_S26Value' }, sucursal: { in: '903_15_S26Value', out: '903_68_S26Value' } } },
  { code: '900_125_Text_C', cols: { caja: { in: '901_16_S26Value', out: '901_69_S26Value' }, corriente: { in: '902_16_S26Value', out: '902_69_S26Value' }, sucursal: { in: '903_16_S26Value', out: '903_69_S26Value' } } },
  { code: '900_126_Text_C', cols: { caja: { in: '901_17_S26Value', out: '901_70_S26Value' }, corriente: { in: '902_17_S26Value', out: '902_70_S26Value' }, sucursal: { in: '903_17_S26Value', out: '903_70_S26Value' } } },
  { code: '900_127_Text_C', cols: { caja: { in: '901_18_S26Value', out: '901_71_S26Value' }, corriente: { in: '902_18_S26Value', out: '902_71_S26Value' }, sucursal: { in: '903_18_S26Value', out: '903_71_S26Value' } } },
  { code: '900_128_Text_C', cols: { caja: { in: '901_19_S26Value', out: '901_72_S26Value' }, corriente: { in: '902_19_S26Value', out: '902_72_S26Value' }, sucursal: { in: '903_19_S26Value', out: '903_72_S26Value' } } },
  { code: '900_129_Text_C', cols: { caja: { in: '901_20_S26Value', out: '901_73_S26Value' }, corriente: { in: '902_20_S26Value', out: '902_73_S26Value' }, sucursal: { in: '903_20_S26Value', out: '903_73_S26Value' } } },
  { code: '900_130_Text_C', cols: { caja: { in: '901_21_S26Value', out: '901_74_S26Value' }, corriente: { in: '902_21_S26Value', out: '902_74_S26Value' }, sucursal: { in: '903_21_S26Value', out: '903_74_S26Value' } } },
  { code: '900_131_Text_C', cols: { caja: { in: '901_22_S26Value', out: '901_75_S26Value' }, corriente: { in: '902_22_S26Value', out: '902_75_S26Value' }, sucursal: { in: '903_22_S26Value', out: '903_75_S26Value' } } },
  { code: '900_132_Text_C', cols: { caja: { in: '901_23_S26Value', out: '901_76_S26Value' }, corriente: { in: '902_23_S26Value', out: '902_76_S26Value' }, sucursal: { in: '903_23_S26Value', out: '903_76_S26Value' } } },
  { code: '900_133_Text_C', cols: { caja: { in: '901_24_S26Value', out: '901_77_S26Value' }, corriente: { in: '902_24_S26Value', out: '902_77_S26Value' }, sucursal: { in: '903_24_S26Value', out: '903_77_S26Value' } } },
  { code: '900_134_Text_C', cols: { caja: { in: '901_25_S26Value', out: '901_78_S26Value' }, corriente: { in: '902_25_S26Value', out: '902_78_S26Value' }, sucursal: { in: '903_25_S26Value', out: '903_78_S26Value' } } },
  { code: '900_135_Text_C', cols: { caja: { in: '901_26_S26Value', out: '901_79_S26Value' }, corriente: { in: '902_26_S26Value', out: '902_79_S26Value' }, sucursal: { in: '903_26_S26Value', out: '903_79_S26Value' } } },
  { code: '900_136_Text_C', cols: { caja: { in: '901_27_S26Value', out: '901_80_S26Value' }, corriente: { in: '902_27_S26Value', out: '902_80_S26Value' }, sucursal: { in: '903_27_S26Value', out: '903_80_S26Value' } } },
  { code: '900_137_Text_C', cols: { caja: { in: '901_28_S26Value', out: '901_81_S26Value' }, corriente: { in: '902_28_S26Value', out: '902_81_S26Value' }, sucursal: { in: '903_28_S26Value', out: '903_81_S26Value' } } },
  { code: '900_138_Text_C', cols: { caja: { in: '901_29_S26Value', out: '901_82_S26Value' }, corriente: { in: '902_29_S26Value', out: '902_82_S26Value' }, sucursal: { in: '903_29_S26Value', out: '903_82_S26Value' } } },
  { code: '900_139_Text_C', cols: { caja: { in: '901_30_S26Value', out: '901_83_S26Value' }, corriente: { in: '902_30_S26Value', out: '902_83_S26Value' }, sucursal: { in: '903_30_S26Value', out: '903_83_S26Value' } } },
  { code: '900_140_Text_C', cols: { caja: { in: '901_31_S26Value', out: '901_84_S26Value' }, corriente: { in: '902_31_S26Value', out: '902_84_S26Value' }, sucursal: { in: '903_31_S26Value', out: '903_84_S26Value' } } },
  { code: '900_141_Text_C', cols: { caja: { in: '901_32_S26Value', out: '901_85_S26Value' }, corriente: { in: '902_32_S26Value', out: '902_85_S26Value' }, sucursal: { in: '903_32_S26Value', out: '903_85_S26Value' } } },
  { code: '900_142_Text_C', cols: { caja: { in: '901_33_S26Value', out: '901_86_S26Value' }, corriente: { in: '902_33_S26Value', out: '902_86_S26Value' }, sucursal: { in: '903_33_S26Value', out: '903_86_S26Value' } } },
  { code: '900_143_Text_C', cols: { caja: { in: '901_34_S26Value', out: '901_87_S26Value' }, corriente: { in: '902_34_S26Value', out: '902_87_S26Value' }, sucursal: { in: '903_34_S26Value', out: '903_87_S26Value' } } },
  { code: '900_144_Text_C', cols: { caja: { in: '901_35_S26Value', out: '901_88_S26Value' }, corriente: { in: '902_35_S26Value', out: '902_88_S26Value' }, sucursal: { in: '903_35_S26Value', out: '903_88_S26Value' } } },
  { code: '900_145_Text_C', cols: { caja: { in: '901_36_S26Value', out: '901_89_S26Value' }, corriente: { in: '902_36_S26Value', out: '902_89_S26Value' }, sucursal: { in: '903_36_S26Value', out: '903_89_S26Value' } } },
  { code: '900_146_Text_C', cols: { caja: { in: '901_37_S26Value', out: '901_90_S26Value' }, corriente: { in: '902_37_S26Value', out: '902_90_S26Value' }, sucursal: { in: '903_37_S26Value', out: '903_90_S26Value' } } },
  { code: '900_147_Text_C', cols: { caja: { in: '901_38_S26Value', out: '901_91_S26Value' }, corriente: { in: '902_38_S26Value', out: '902_91_S26Value' }, sucursal: { in: '903_38_S26Value', out: '903_91_S26Value' } } },
  { code: '900_148_Text_C', cols: { caja: { in: '901_39_S26Value', out: '901_92_S26Value' }, corriente: { in: '902_39_S26Value', out: '902_92_S26Value' }, sucursal: { in: '903_39_S26Value', out: '903_92_S26Value' } } },
  { code: '900_149_Text_C', cols: { caja: { in: '901_40_S26Value', out: '901_93_S26Value' }, corriente: { in: '902_40_S26Value', out: '902_93_S26Value' }, sucursal: { in: '903_40_S26Value', out: '903_93_S26Value' } } },
  { code: '900_150_Text_C', cols: { caja: { in: '901_41_S26Value', out: '901_94_S26Value' }, corriente: { in: '902_41_S26Value', out: '902_94_S26Value' }, sucursal: { in: '903_41_S26Value', out: '903_94_S26Value' } } },
  { code: '900_151_Text_C', cols: { caja: { in: '901_42_S26Value', out: '901_95_S26Value' }, corriente: { in: '902_42_S26Value', out: '902_95_S26Value' }, sucursal: { in: '903_42_S26Value', out: '903_95_S26Value' } } },
  { code: '900_152_Text_C', cols: { caja: { in: '901_43_S26Value', out: '901_96_S26Value' }, corriente: { in: '902_43_S26Value', out: '902_96_S26Value' }, sucursal: { in: '903_43_S26Value', out: '903_96_S26Value' } } },
  { code: '900_153_Text_C', cols: { caja: { in: '901_44_S26Value', out: '901_97_S26Value' }, corriente: { in: '902_44_S26Value', out: '902_97_S26Value' }, sucursal: { in: '903_44_S26Value', out: '903_97_S26Value' } } },
  { code: '900_154_Text_C', cols: { caja: { in: '901_45_S26Value', out: '901_98_S26Value' }, corriente: { in: '902_45_S26Value', out: '902_98_S26Value' }, sucursal: { in: '903_45_S26Value', out: '903_98_S26Value' } } },
  { code: '900_155_Text_C', cols: { caja: { in: '901_46_S26Value', out: '901_99_S26Value' }, corriente: { in: '902_46_S26Value', out: '902_99_S26Value' }, sucursal: { in: '903_46_S26Value', out: '903_99_S26Value' } } },
  { code: '900_156_Text_C', cols: { caja: { in: '901_47_S26Value', out: '901_100_S26Value' }, corriente: { in: '902_47_S26Value', out: '902_100_S26Value' }, sucursal: { in: '903_47_S26Value', out: '903_100_S26Value' } } },
  { code: '900_157_Text_C', cols: { caja: { in: '901_48_S26Value', out: '901_101_S26Value' }, corriente: { in: '902_48_S26Value', out: '902_101_S26Value' }, sucursal: { in: '903_48_S26Value', out: '903_101_S26Value' } } },
  { code: '900_158_Text_C', cols: { caja: { in: '901_49_S26Value', out: '901_102_S26Value' }, corriente: { in: '902_49_S26Value', out: '902_102_S26Value' }, sucursal: { in: '903_49_S26Value', out: '903_102_S26Value' } } },
  { code: '900_159_Text_C', cols: { caja: { in: '901_50_S26Value', out: '901_103_S26Value' }, corriente: { in: '902_50_S26Value', out: '902_103_S26Value' }, sucursal: { in: '903_50_S26Value', out: '903_103_S26Value' } } },
  { code: '900_160_Text_C', cols: { caja: { in: '901_51_S26Value', out: '901_104_S26Value' }, corriente: { in: '902_51_S26Value', out: '902_104_S26Value' }, sucursal: { in: '903_51_S26Value', out: '903_104_S26Value' } } },
  { code: '900_161_Text_C', cols: { caja: { in: '901_52_S26Value', out: '901_105_S26Value' }, corriente: { in: '902_52_S26Value', out: '902_105_S26Value' }, sucursal: { in: '903_52_S26Value', out: '903_105_S26Value' } } },
];

function mapS26(s26: S26, header: { label: string; city: string; state: string }) {
  const out: Record<string, string> = {
    '900_1_Text_C': header.label,
    '900_2_Text_C': header.city,
    '900_3_Text_C': header.state,
    '900_4_Text_C': s26.monthLabel,
  };

  // Rejilla de asientos: solo se rellena cuando el mapa esté calibrado.
  s26.rows.forEach((r, i) => {
    const f = S26_ROW_FIELDS[i];
    if (!f) return;                       // más asientos que filas del formulario
    if (f.date) out[f.date] = String(Number(r.date.slice(8, 10)));
    if (f.desc) out[f.desc] = r.description;
    if (f.code) out[f.code] = r.code ?? '';
    for (const a of ACCOUNTS) {
      out[f.cols[a].in]  = amt(r.cols[a].in);
      out[f.cols[a].out] = amt(r.cols[a].out);
    }
  });

  return out;
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

export async function fillS26(
  s26: S26,
  header: { label: string; city: string; state: string },
  opts: FillOptions = {},
): Promise<Uint8Array> {
  return fill('s26', mapS26(s26, header), opts);
}

/** ¿Está calibrada la rejilla del S-26? La interfaz lo advierte si no. */
export const s26GridCalibrated = () => S26_ROW_FIELDS.length > 0;

/* ── Relleno ────────────────────────────────────────────────────────────────── */

function setField(form: PDFForm, name: string, value: string) {
  try {
    form.getTextField(name).setText(value);
  } catch {
    // Campo inexistente o de otro tipo (casilla de verificación): se ignora.
  }
}

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
    // Cada casilla muestra su nombre: se imprime, se compara con el formulario
    // oficial y se corrigen los mapas de arriba.
    for (const f of form.getFields()) {
      setField(form, f.getName(), f.getName().replace(/_Text_C|_Text|_S30_/g, (m: string) => m === '_S30_' ? '_' : ''));
    }
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
