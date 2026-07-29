# War-game: S-16 — Hojas de asignación S-89 individuales (tamaño 85×127 mm) + exportación PDF/DOCX/XLSX/CSV
> Executor: ejecuta los moves en orden. Antes de cada move, lee sus señales de fallo. Revisa las condiciones de aborto después de cada move. Esto es un war-game, NO un plan feliz: cada move dice qué esperar si funciona, qué señal indica fallo, la causa más probable y la contramedida.

## Mission objective
Agregar al modal de impresión de `meeting-scheduler-pro` una **segunda modalidad** de Hojas de Asignación (S-89): impresión **individual** en hojitas de **85 mm de ancho** (una asignación por página), donde cada página contiene **únicamente los datos del asignado** posicionados como en el documento Word modelo (SIN títulos, SIN líneas, SIN cuadritos) — pensadas para imprimirse sobre hojitas S-89 preimpresas. Debe incluir **solo las asignaciones estudiantiles**: desde la *Lectura de la Biblia* (parte 3) hasta la última parte de estudiante (parte 6 o 7, según la semana). Además debe permitir **exportar** en:
- **PDF** (una hojita por página, 85 mm de ancho, layout del modelo).
- **DOCX** (idéntico al modelo Word, una hojita por sección/página).
- **XLSX** (ver *Unresolved assumptions* #3 sobre si es tabla de datos o layout de hojita).
- **CSV** con exactamente estas columnas: `Nombre, Ayudante, Fecha, Num de Intervencion, Sala`.

**Criterio de éxito medible:**
1. En el modal de impresión aparece una opción nueva (toggle o botón de reporte) "Hojas S-89 individuales".
2. Con una semana seleccionada que tenga N partes de estudiante (3..6/7 con `assigned_user_id`), el PDF individual genera **N páginas**, cada una de 85 mm de ancho, con Nombre / Ayudante / Fecha / (Núm + título) / Sala posicionados como el modelo.
3. El DOCX abre en Word con tamaño de página 85 mm y reproduce el modelo.
4. El CSV descargado tiene 5 columnas exactas y una fila por parte de estudiante asignada.
5. `next build` limpio (0 errores TS) antes de push. Deploy verde vía CI (`vps-selfhosted`).

## Recon summary (hechos verificados en el código y el modelo Word — NO re-investigar)

### Documento Word modelo (`FORMATO ASIGNACIONES VYMC.docx`) — geometría exacta extraída
- **Tamaño de página:** `w:pgSz w="4819" h="7200"` twips = **85.0 mm × 127.0 mm** (7200 twips = 5.0 in = 127 mm exactos). ⚠️ El usuario dijo "85×115 mm" — ver Unresolved assumption #1.
- **Márgenes:** todos 0 (`top=0 right=0 bottom=0 left=0`), `header=709 footer=709` twips.
- **Sin tablas** (`<w:tbl>` count = 0). Todo son párrafos con tabulación izquierda a **`w:pos="1701"` twips = 30.0 mm** desde el borde izquierdo.
- **Fuente:** `Amasis MT Pro Black` (⚠️ no estándar — ver Unresolved assumption #4). Fallback razonable: una serif pesada o Arial Bold.
- **Solo 5 párrafos tienen texto.** Secuencia vertical completa (sz en half-points; 1 pt = sz/2):

  | Párrafo | sz | pt | Contenido (ejemplo del modelo) | Semántica |
  |---|---|---|---|---|
  | p0 | 18 | 9  | (vacío) | espaciador |
  | p1 | 18 | 9  | (vacío) | espaciador |
  | p2 | 18 | 9  | (vacío) | espaciador |
  | p3 | 16 | 8  | (vacío) | espaciador |
  | **p4** | 22 | 11 | `Elvia Rauda` | **Nombre estudiante** |
  | p5 | 20 | 10 | (vacío) | espaciador |
  | **p6** | 22 | 11 | `Evangelina Contreras` | **Ayudante** |
  | p7 | 12 | 6  | (vacío) | espaciador |
  | **p8** | 22 | 11 | `10 de agosto 2026` | **Fecha (formato largo ES)** |
  | p9 | 16 | 8  | (vacío) | espaciador |
  | **p10** | 20 | 10 | `‹tab›‹tab›4 Empiece conversaciones` | **Núm. intervención + título corto** |
  | p11–p13 | 18 | 9 | (vacío) | espaciadores |
  | p14 | 16 | 8  | (vacío) | espaciador |
  | **p15** | 28 | 14 | `‹7 espacios›X` | **Sala (marca)** |
  | p16–p27 | 18 | 9 | (vacío) | espaciadores finales |

- **Observaciones clave del modelo:**
  - La fecha va en **formato largo español**: "10 de agosto 2026" (NO el formato con barras `2026/08/10` que usa el S-89 multi-up actual). Hay que añadir un helper de fecha larga (NO existe uno en `src/lib/*.ts`, verificado).
  - La línea de asignación es **solo número + título corto** ("4 Empiece conversaciones"), **SIN duración** (el S-89 multi-up actual sí añade `(3 min.)`; el individual NO).
  - La "X" grande (14 pt) marca la **Sala** — en el modelo aparece una sola marca. Ver Unresolved assumption #2 sobre cómo mapear main/aux_1/aux_2.
  - p10 y p15 tienen tabs/espacios extra a la izquierda además del tab de 30 mm (indent adicional). Reproducir aprox.

### Código existente (verificado)
- **Archivo a modificar:** `src/components/PrintModal.tsx`. Es un modal client-side. El S-89 actual vive en la rama `reportType === 's89'` (línea ~513) y renderiza HTML con `border border-black`, títulos, checkboxes, **varias hojitas por página carta** vía `window.print()`. **NO tocar/romper esta rama** — la individual es adicional.
- **Filtro de partes de estudiante (ya usado por el S-89 actual, línea ~521-522):**
  ```ts
  (selectedMeeting.parts as Part[]).filter(p => p.role === 'student' && p.assigned_user_id)
  ```
  Verificado en `src/lib/programs.ts`: parte 3 = `bible_reading` (role `student`), partes 4–6/7 = `student_part` (role `student`). Este filtro ES exactamente "de Lectura de la Biblia hasta la 6 o 7". Reusarlo tal cual. Algunas semanas tienen 7 partes (programs.ts:106), otras 6 — el filtro lo maneja solo.
- **Tipo `Part`** (PrintModal.tsx:22-37) tiene: `part_number:number`, `class_type:'main'|'aux_1'|'aux_2'`, `part_type:string`, `title:string`, `duration_minutes:number`, `users?:{name}` (estudiante), `assistant?:{name}` (ayudante), `study_point?`, `student_part_type?`.
- **Helpers reutilizables ya en PrintModal.tsx:** `s89Title(p)` (línea 145: "Lectura de la Biblia" / "Discurso" / título limpio) → usar para la línea de asignación. `fmtJW(date)` (barras) → NO usar para la fecha del individual, hacer helper largo.
- **`selectedMeeting.date`** es ISO `YYYY-MM-DD`. `selectedMeeting.parts` ya viene cargado en cliente (no hace falta fetch).
- **Nombre de congregación:** hardcodeado `CONGREGATION_NAME = 'La Estación'` (PrintModal.tsx:6). El individual no muestra congregación (el modelo no la tiene), pero los nombres de archivo de export pueden usarla.

### Stack de exportación (verificado en `src/lib/exportReport.ts` y `package.json`) — TODO client-side vía dynamic import
- Deps presentes: **`docx ^9.7.1`**, **`jspdf ^4.2.1`**, `jspdf-autotable ^5.0.8`, **`xlsx-js-style ^1.2.0`**, `better-sqlite3 ^13.0.1`, `next 16.2.6`.
- Patrón de descarga: helper `downloadBlob(blob, filename)` (crear uno local igual, o extraer/importar). Los exports actuales (`exportPdf/exportDocx/exportXlsx`) son **orientados a tabla** (`{columns, rows}`) — **NO sirven para el layout de hojita**; hay que escribir generadores nuevos orientados a layout.
- `ExportMenu.tsx` **precarga los módulos en `useEffect` al montar** (`import('jspdf')` etc.) para no perder el user-gesture window de Chrome (~1 s). Replicar ese precargado si se usa un menú de export nuevo.
- `jsPDF` soporta formato custom: `new jsPDF({ unit:'mm', format:[85,127], orientation:'portrait' })`. `doc.text(txt, xMm, yMm)` donde `y` es la **baseline**.
- `docx` (librería programática) soporta `sectionProperties` con `page: { size: { width, height }, margin: {...} }` en **twips**; usar `width:4819, height:7200, margin: {top:0,...}`. Un slip por `section` con `properties: { type: SectionType.NEXT_PAGE }` fuerza salto de página.

### Fecha larga en español (helper a crear)
```ts
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function fmtFechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} ${y}`;  // "10 de agosto 2026"
}
```

## Moves

### Move 1: Crear módulo de datos puro `src/lib/s89Individual.ts`
- **Action:** Crear un módulo SIN dependencias de React ni de `better-sqlite3` (import-safe desde cliente) que exponga:
  - `type SlipData = { nombre: string; ayudante: string; fechaLarga: string; fechaIso: string; numIntervencion: number; tituloCorto: string; sala: 'main'|'aux_1'|'aux_2' }`.
  - `buildSlips(meeting): SlipData[]` que filtra `parts.filter(p => p.role==='student' && p.assigned_user_id)`, ordena por `part_number`, y mapea cada parte a `SlipData` usando `p.users?.name`, `p.assistant?.name ?? ''`, `fmtFechaLarga(meeting.date)`, `p.part_number`, y un título corto (reutilizar la lógica de `s89Title`; para evitar dependencia circular con PrintModal, **mover `s89Title`/`extractLocation`/`extractScripture` a este módulo o duplicar la función pura aquí**).
  - `fmtFechaLarga` (arriba).
  - `salaLabel(sala)` y `salaCsv(sala)` (ver Unresolved #2).
- **Expected observation if it worked:** `import` desde un archivo cliente compila; `buildSlips` sobre un meeting de ejemplo devuelve 3–5 objetos con los 6 campos poblados. `next build` no rompe.
- **Expected observation if it failed:** Build error `Module not found: Can't resolve 'fs'` (metiste algo de servidor) o `Cannot find name 's89Title'`.
- **Most likely cause of failure:** Importar desde `PrintModal.tsx` (que es `'use client'` pero arrastra `lucide-react`) o desde algo que toque sqlite. Mantener este módulo 100% puro.
- **Countermove:** Duplicar las 3 funciones puras (`s89Title`, `extractLocation`, `extractScripture`) dentro de `s89Individual.ts` en vez de importarlas. Son ~10 líneas.
- **Downstream consequences:** Todos los generadores (PDF/DOCX/XLSX/CSV) consumen `SlipData[]` de aquí — una sola fuente de verdad. Si el mapeo de `sala`/título se decide mal aquí, se propaga a los 4 formatos.

### Move 2: Generador PDF individual `exportS89IndividualPdf(slips, opts)`
- **Action:** En `src/lib/exportReport.ts` (o un archivo nuevo `src/lib/exportS89.ts`), función async que hace `const { jsPDF } = unwrap(await import('jspdf'))` y por cada slip: si no es el primero `doc.addPage([85,127],'portrait')`, luego coloca el texto con `doc.text()` a coordenadas mm. **Coordenadas iniciales estimadas** (baseline, x=30 mm salvo indicado; derivadas de la geometría del modelo, altura de línea ≈ pt×1.15):

  | Campo | x (mm) | y baseline (mm) | fontSize (pt) | bold |
  |---|---|---|---|---|
  | Nombre | 30 | 18 | 11 | sí |
  | Ayudante | 30 | 26.5 | 11 | sí |
  | Fecha (larga) | 30 | 33.5 | 11 | sí |
  | Núm + título | 33 | 41 | 10 | no |
  | Sala (marca) | 33 | 60.5 | 14 | sí |

  ⚠️ **Estas coordenadas son ESTIMADAS y DEBEN afinarse** contra una hojita física (ver Move 7). El offset del header (709 twips ≈ 12.5 mm) puede desplazar todo hacia abajo; afinar en bloque con una sola constante `Y_OFFSET`.
- **Expected observation if it worked:** El PDF descargado abre con N páginas, cada una 85 mm de ancho (verificable en el visor: propiedades de página); los 5 textos aparecen en la mitad superior sin títulos ni recuadros.
- **Expected observation if it failed:** Una sola página con todo encimado (olvidaste `addPage`), o páginas tamaño carta (olvidaste pasar `format` a `addPage`/constructor), o texto cortado por el borde (x demasiado grande para 85 mm).
- **Most likely cause of failure:** `jsPDF` default es A4; el `format` custom debe ir tanto en el constructor como en cada `addPage`. Con unit `mm`, x=30 deja 55 mm de ancho para el nombre — nombres largos (>~28 chars) se salen. 
- **Countermove:** Pasar `format:[85,127]` explícito en constructor y en cada `addPage(format, orientation)`. Para nombres largos: reducir fontSize dinámicamente o `doc.text(txt, x, y, { maxWidth: 52 })`.
- **Downstream consequences:** El `Y_OFFSET` que se calibre aquí NO aplica al DOCX (el DOCX reproduce por párrafos, no por coordenadas). Documentar ambos por separado.

### Move 3: Generador DOCX individual `exportS89IndividualDocx(slips)`
- **Action:** `const docx = unwrap(await import('docx'))`. Construir **una sección por slip** con `properties.page = { size: { width:4819, height:7200 }, margin:{ top:0,right:0,bottom:0,left:0, header:709, footer:709 } }` (twips) y `type: SectionType.NEXT_PAGE` (salto de página entre slips). Dentro de cada sección, reproducir la secuencia de párrafos del modelo: espaciadores vacíos con el `size` exacto de la tabla de recon (Word `size` = half-points, o sea sz tal cual: 18,18,18,16 antes del nombre, etc.) y párrafos de valor con `indent: { left: 1701 }` (twips) o un `TabStop` a 1701, `spacing: { after:0, line:240, lineRule:'auto' }`. Fuente objetivo `Amasis MT Pro Black` con fallback.
- **Expected observation if it worked:** Al abrir en Word/LibreOffice, la página mide 85 mm, los valores caen en las mismas alturas relativas que el modelo, sin títulos/líneas/recuadros.
- **Expected observation if it failed:** Página tamaño carta (olvidaste `size` en twips o lo pusiste en la sección equivocada), o todos los slips en una sola página (falta `SectionType.NEXT_PAGE`), o espaciado colapsado (olvidaste los párrafos vacíos con su `size`).
- **Most likely cause of failure:** En `docx` v9 la geometría de página va en `sections[i].properties` (no en `Document`); un solo `section` con muchos párrafos NO produce páginas separadas de 85 mm. Cada slip necesita su propia `section`.
- **Countermove:** Un array `sections: slips.map(s => ({ properties:{ type: NEXT_PAGE, page:{...} }, children:[...párrafos...] }))`. Validar con `Packer.toBlob`.
- **Downstream consequences:** Ninguna hacia otros moves; es el formato más fiel al modelo. Si se prefiere fidelidad perfecta, la alternativa es substitución de plantilla (ver Unresolved #5) — pero eso complica el multi-slip.

### Move 4: Generador XLSX + CSV
- **Action:**
  - **CSV:** función pura que construye el string con cabecera exacta `Nombre,Ayudante,Fecha,Num de Intervencion,Sala` y una fila por slip. **Escapar** comas/comillas/saltos con comillas dobles (RFC 4180). `Fecha` = fecha larga o ISO (ver Unresolved #6). `Sala` = `salaCsv(sala)` (Unresolved #2). Descargar con `new Blob([csv], {type:'text/csv;charset=utf-8'})` + `downloadBlob`. **Prepender BOM `﻿`** para que Excel respete UTF-8 (acentos en "Núm"/nombres).
  - **XLSX:** `const XLSX = unwrap(await import('xlsx-js-style'))`. Ver Unresolved #3: por defecto, **tabla de datos con las mismas 5 columnas del CSV** (`aoa_to_sheet([cols, ...rows])`, anchos con `!cols`), `writeFile(wb, nombre.xlsx)`.
- **Expected observation if it worked:** CSV abre en Excel con 5 columnas, acentos correctos, una fila por parte. XLSX igual.
- **Expected observation if it failed:** Acentos rotos (`NÃºm`) → falta BOM. Columnas corridas → falta escapado de comas en nombres. 
- **Most likely cause of failure:** Nombres con coma ("Apellido, Nombre") rompen el CSV sin escapado; falta de BOM rompe acentos en Excel Windows.
- **Countermove:** Escapado RFC 4180 + BOM. Test manual con un nombre que contenga coma y acento.
- **Downstream consequences:** El header CSV es contrato del usuario: `Nombre, Ayudante, Fecha, Num de Intervencion, Sala` — respetar mayúsculas/espacios como el usuario los escribió (sin acento en "Num", con "de Intervencion").

### Move 5: UI en `PrintModal.tsx` — nueva modalidad + botones de export
- **Action:** Dos opciones (elige la de menor riesgo):
  - **(Recomendada)** Añadir un **toggle dentro de la rama `s89`** ("Varias por hoja" | "Individual 85 mm"). Cuando "Individual" esté activo, mostrar 4 botones: **PDF, DOCX, XLSX, CSV** (además del Imprimir existente). No crear un `reportType` nuevo evita tocar el `type ReportType` y el switch.
  - (Alternativa) Añadir `'s89ind'` a `type ReportType` y un item en el sidebar. Más invasivo.
  - Precargar `import('jspdf'); import('docx'); import('xlsx-js-style')` en un `useEffect` al abrir el modal (patrón de `ExportMenu`). Handlers llaman a los generadores de Moves 2–4 con `buildSlips(selectedMeeting)`.
  - Deshabilitar los botones si `buildSlips(selectedMeeting).length === 0` y mostrar el mensaje "No hay partes de estudiante asignadas".
- **Expected observation if it worked:** Con una semana seleccionada, aparece el toggle; al hacer clic en cada botón se descarga el archivo correspondiente; sin semana seleccionada se ve el placeholder existente.
- **Expected observation if it failed:** El clic no descarga nada y en consola sale `NotAllowedError`/gesture expired, o `undefined is not a function` (unwrap del módulo mal).
- **Most likely cause of failure:** Dynamic import lento perdiendo el user-gesture window; o `doc.output('blob')` devuelto sin `await`.
- **Countermove:** Precargar módulos al abrir modal; `setBusy(true)` durante la generación; `await` en todo. Reusar `unwrap()` de `exportReport.ts`.
- **Downstream consequences:** No romper la rama `s89` multi-up existente ni `window.print()`. La rama nueva es aditiva.

### Move 6: `next build` local ANTES de push
- **Action:** `cd meeting-scheduler-pro && npm run build` (o `next build`). Corregir todo error TS (recordar: Zod v4 usa `.issues[0]`; tipar `SlipData`; `class_type` es unión estricta).
- **Expected observation if it worked:** `✓ Compiled successfully`, 0 errores de tipo.
- **Expected observation if it failed:** Error TS de tipos (`Property 'name' does not exist on ...`) o `'docx' has no exported member 'SectionType'`.
- **Most likely cause of failure:** `unwrap` de `docx` y acceso a `SectionType`/`Packer`; tipos de `Part` opcionales (`users?`).
- **Countermove:** Desestructurar tras `unwrap`; usar `?.` y defaults; castear el meeting a un tipo mínimo local.
- **Downstream consequences:** **Los errores TS solo aparecen en modo build, no en dev** — nunca hacer push sin build limpio (regla del proyecto).

### Move 7: Verificación visual + afinado de coordenadas (PDF), luego deploy CI
- **Action:** Generar el PDF individual con datos reales, imprimir en una **hojita S-89 física preimpresa** (o superponer contra un escaneo del modelo) y **ajustar `Y_OFFSET`/x** hasta que los 5 valores caigan en su lugar. Confirmar DOCX en Word. Luego commit + push a `vps-selfhosted` para deploy CI.
- **Expected observation if it worked:** Los valores del PDF caen sobre las líneas de la hojita preimpresa dentro de ±1–2 mm. Deploy verde, app carga en prod.
- **Expected observation if it failed:** Texto desplazado sistemáticamente (offset global) o comprimido/estirado (asumiste 115 mm pero el papel es 127, o viceversa — ver Unresolved #1).
- **Most likely cause of failure:** Discrepancia 85×127 (docx) vs 85×115 (usuario). Si el papel real es 115 mm, el `format` debe ser `[85,115]` y las Y se recalibran.
- **Countermove:** Parametrizar el alto de página como constante `SLIP_H` y todas las Y como fracción/offset ajustable. Preguntar al usuario el alto físico real ANTES de dar por cerrado (Unresolved #1).
- **Downstream consequences:** No hacer `--delete` en rsync ni tocar `ecosystem.config.cjs`; `HOSTNAME=0.0.0.0`; reinicio PM2 completo solo si cambian envs (aquí NO cambian). El deploy es solo código.

## Unresolved assumptions
1. **Alto físico de la hojita: 85×127 mm (docx) vs 85×115 mm (dicho por el usuario).** El `.docx` dice 7200 twips = 127 mm exactos, pero el usuario escribió "85mm x 115mm". No se puede resolver sin el papel físico. **Acción del executor:** parametrizar `SLIP_H` (constante única), usar 127 para reproducir el docx fielmente, y **preguntar al usuario** el alto real antes de dar por cerrada la calibración. NO inventar un tercer valor.
2. **Mapeo de `class_type` → columna "Sala" (CSV) y marca "X" (hojita).** El modelo muestra una "X" grande. El usuario escribió `Sala (en sala X para principal)`, ambiguo. Interpretación por defecto propuesta (CONFIRMAR con usuario): CSV → `main`="Principal", `aux_1`="Auxiliar 1", `aux_2`="Auxiliar 2"; hojita → la marca "X" indica la sala asignada, o el texto "Sala principal/auxiliar N". NO se puede resolver con certeza desde el material dado.
3. **Formato XLSX: ¿tabla de datos (como CSV) o layout de hojita?** El usuario listó columnas explícitas SOLO para CSV, y puso PDF/DOCX/XLSX juntos como "la hojita". Un XLSX con hojitas posicionadas (celdas dimensionadas a mm, valores colocados) es factible pero de bajo valor y frágil. **Default propuesto:** XLSX = tabla de datos con las mismas 5 columnas del CSV. Confirmar con usuario si en realidad quería hojitas en XLSX.
4. **Fuente `Amasis MT Pro Black`** no es estándar y casi seguro no está en el VPS ni en la máquina del usuario receptor. En PDF (jsPDF) solo hay fuentes core (helvetica/times/courier) salvo que se embeba una fuente. En DOCX se puede nombrar la fuente y Word sustituye. **Default:** PDF usa `helvetica`/`times` bold; DOCX nombra `Amasis MT Pro Black` con fallback. Confirmar si el usuario exige la fuente exacta (requeriría embeber TTF en jsPDF).
5. **Estrategia DOCX: reconstrucción programática (Move 3) vs substitución de plantilla.** La reconstrucción con `docx` es más simple para multi-slip pero puede diferir en detalles finos. La substitución (tomar el `.docx` modelo, reemplazar los 5 literales por placeholders, duplicar el body por slip dentro del zip) es pixel-perfect pero más frágil de implementar para N slips. Default: reconstrucción programática (Move 3). Si el usuario exige fidelidad exacta, cambiar a plantilla.
6. **Formato de "Fecha" en CSV/XLSX:** ¿larga ("10 de agosto 2026") o ISO ("2026-08-10")? El modelo de hojita usa larga. Default para CSV/XLSX: **larga** (consistente con la hojita); confirmar si prefieren ISO para ordenar en Excel.
7. **Alcance: semana seleccionada vs mes completo.** El S-89 actual opera sobre `selectedMeeting` (una semana). El usuario está en el modal de "programa mensual". Default: **una semana** (igual que el S-89 actual). Fácil de extender a mes iterando `monthlyMeetings`. Confirmar.

## Abort conditions
- **Aborta y reporta** si `selectedMeeting` no trae `parts` con `role`/`assigned_user_id` poblados en cliente (el filtro daría 0 y no habría nada que generar) — investigar el shape real antes de seguir.
- **Aborta** si `next build` falla y el error no se resuelve con los patrones conocidos (Zod v4 `.issues`, `unwrap`, opcionales `?.`) tras 2 intentos — reportar el error TS textual.
- **Aborta la calibración** (Move 7) y pregunta al usuario si la discrepancia 127 vs 115 mm hace que el texto no caiga en la hojita física — NO adivines el alto.
- **NO** modifiques la rama `reportType === 's89'` existente (multi-up) ni el `window.print()`. Si para insertar el toggle hay que refactorizar esa rama de forma que cambie su salida, detente y reporta.
- **NO** toques deploy/infra más allá del push a `vps-selfhosted` (regla del proyecto: sin `--delete` en rsync, `HOSTNAME=0.0.0.0`, sin reinicios PM2 innecesarios).

## Ver también
- `wargames/msp-s15-endurecimiento-seguridad.md` (wargame previo)
- `src/components/PrintModal.tsx`, `src/lib/exportReport.ts`, `src/lib/programs.ts`
