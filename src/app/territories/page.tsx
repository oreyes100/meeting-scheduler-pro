'use client';

import React, { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Plus, Trash2, Save, X, Undo2, Check, Crosshair, SquareDashed,
  History, FileDown, ChevronDown, FileText, FileSpreadsheet,
} from 'lucide-react';
import type { LatLng } from '@/components/TerritoryMap';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';

const TerritoryMap = dynamic(() => import('@/components/TerritoryMap'), { ssr: false });

interface Territory {
  id: string;
  number: number | null;
  name: string;
  color: string;
  coordinates: LatLng[];
  group_name: string | null;
  assigned_to: string | null;
  assigned_name?: string | null;
  visit_start: string | null;
  visit_end: string | null;
  note: string | null;
  status: 'available' | 'assigned' | 'completed';
}

interface Assignment {
  id: string;
  territory_id: string;
  assigned_name: string;
  assigned_date: string | null;
  completed_date: string | null;
}

const PALETTE = ['#3d7d8e', '#c0392b', '#27ae60', '#8e44ad', '#d35400', '#2980b9', '#16a085', '#c9a227'];
const STATUS_LABEL: Record<string, string> = { available: 'Disponible', assigned: 'Asignado', completed: 'Completado' };
const STATUS_COLOR: Record<string, string> = { available: 'bg-slate-100 text-slate-600', assigned: 'bg-amber-100 text-amber-700', completed: 'bg-emerald-100 text-emerald-700' };

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y?.slice(2)}`;
}

function currentServiceYear() {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
}

// ── S-13 helpers ─────────────────────────────────────────────────────────────

function getSlots(t: Territory, allAssignments: Assignment[]) {
  const tas = allAssignments
    .filter(a => a.territory_id === t.id)
    .sort((a, b) => (a.assigned_date ?? '').localeCompare(b.assigned_date ?? ''));
  const lastCompleted = [...tas].reverse().find(a => a.completed_date)?.completed_date ?? null;
  // Each slot: [name, assignedDate, completedDate]
  const slots = [0, 1, 2, 3].flatMap(i => {
    const a = tas[i];
    return [a?.assigned_name ?? '', a?.assigned_date ? fmt(a.assigned_date) : '', a?.completed_date ? fmt(a.completed_date) : ''];
  });
  return { lastCompleted, slots };
}

// S-13 PDF — 14 columns matching official template
// Col layout: [Núm] [Última] [Nombre1][Asignó1][Completó1] × 4
async function exportPdf(territories: Territory[], allAssignments: Assignment[], year: number) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const sorted = [...territories].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));

  // Draw header on each page
  const drawPageHeader = (pageNum: number) => {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('REGISTRO DE ASIGNACIÓN DE TERRITORIO', pageW / 2, 10, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Año de servicio:  ${year}`, 14, 17);
    if (pageNum > 1) doc.text(`(continuación)`, pageW - 14, 17, { align: 'right' });
  };

  drawPageHeader(1);

  // Header: row 1 uses rowSpan=2 for first 2 cols; colSpan=3 for each "Asignado a"
  const head = [
    [
      { content: 'Núm.\nde terr.', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
      { content: 'Última\nfecha en\nque se\ncompletó*', rowSpan: 2, styles: { valign: 'middle' as const, halign: 'center' as const } },
      { content: 'Asignado a', colSpan: 3, styles: { halign: 'center' as const } },
      { content: 'Asignado a', colSpan: 3, styles: { halign: 'center' as const } },
      { content: 'Asignado a', colSpan: 3, styles: { halign: 'center' as const } },
      { content: 'Asignado a', colSpan: 3, styles: { halign: 'center' as const } },
    ],
    [
      // sub-row for each slot (cols 3-14); cols 1-2 occupied by rowSpan above
      { content: 'Nombre',                    styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Fecha en que\nse asignó',   styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Fecha en que\nse completó', styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Nombre',                    styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Fecha en que\nse asignó',   styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Fecha en que\nse completó', styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Nombre',                    styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Fecha en que\nse asignó',   styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Fecha en que\nse completó', styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Nombre',                    styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Fecha en que\nse asignó',   styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
      { content: 'Fecha en que\nse completó', styles: { halign: 'center' as const, fontStyle: 'italic' as const } },
    ],
  ];

  const body = sorted.map(t => {
    const { lastCompleted, slots } = getSlots(t, allAssignments);
    return [
      { content: String(t.number ?? ''), styles: { halign: 'center' as const } },
      { content: fmt(lastCompleted), styles: { halign: 'center' as const } },
      ...slots,
    ];
  });

  let pageCount = 1;
  autoTable(doc, {
    head,
    body,
    startY: 21,
    styles: { fontSize: 7, cellPadding: { top: 1.5, right: 1, bottom: 1.5, left: 1 }, lineWidth: 0.25, lineColor: [160, 160, 170], minCellHeight: 8 },
    headStyles: { fillColor: [210, 220, 235], textColor: [20, 20, 50], fontStyle: 'bold', fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' as const },
      1: { cellWidth: 18, halign: 'center' as const },
      2: { cellWidth: 25 },
      3: { cellWidth: 16, halign: 'center' as const },
      4: { cellWidth: 16, halign: 'center' as const },
      5: { cellWidth: 25 },
      6: { cellWidth: 16, halign: 'center' as const },
      7: { cellWidth: 16, halign: 'center' as const },
      8: { cellWidth: 25 },
      9: { cellWidth: 16, halign: 'center' as const },
      10: { cellWidth: 16, halign: 'center' as const },
      11: { cellWidth: 25 },
      12: { cellWidth: 16, halign: 'center' as const },
      13: { cellWidth: 16, halign: 'center' as const },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    margin: { left: 8, right: 8, bottom: 14 },
    didDrawPage: (data) => {
      // Footer
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.text(
        '*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.',
        8, pageH - 8
      );
      doc.text('S-13-S  1/22', 8, pageH - 4);
      doc.text(`Año de servicio: ${year}`, pageW - 8, pageH - 4, { align: 'right' });
      // Re-draw title on pages after the first
      if (data.pageNumber > pageCount) {
        pageCount = data.pageNumber;
        drawPageHeader(data.pageNumber);
      }
    },
  });

  doc.save(`S-13_${year}.pdf`);
}

// S-13 XLSX — 14 data columns with merged header rows
async function exportXlsx(territories: Territory[], allAssignments: Assignment[], year: number) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const sorted = [...territories].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));

  // Row 1: title
  // Row 2: año de servicio
  // Row 3: blank
  // Row 4: top header (Núm | Última | Asignado a (colspan 3) ×4)
  // Row 5: sub-header (blank | blank | Nombre | Asignó | Completó ×4)
  // Row 6+: data

  const row4 = [
    'Núm. de terr.',
    'Última fecha\nen que se\ncompletó*',
    'Asignado a', '', '',
    'Asignado a', '', '',
    'Asignado a', '', '',
    'Asignado a', '', '',
  ];
  const row5 = [
    '', '',
    'Nombre', 'Fecha en que se asignó', 'Fecha en que se completó',
    'Nombre', 'Fecha en que se asignó', 'Fecha en que se completó',
    'Nombre', 'Fecha en que se asignó', 'Fecha en que se completó',
    'Nombre', 'Fecha en que se asignó', 'Fecha en que se completó',
  ];

  const dataRows = sorted.map(t => {
    const { lastCompleted, slots } = getSlots(t, allAssignments);
    return [t.number ?? '', fmt(lastCompleted), ...slots];
  });

  const allRows = [
    ['REGISTRO DE ASIGNACIÓN DE TERRITORIO'],
    [`Año de servicio: ${year}`],
    [],
    row4,
    row5,
    ...dataRows,
    [],
    ['*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.'],
    ['S-13-S  1/22'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws['!cols'] = [
    { wch: 10 }, { wch: 16 },
    { wch: 22 }, { wch: 14 }, { wch: 14 },
    { wch: 22 }, { wch: 14 }, { wch: 14 },
    { wch: 22 }, { wch: 14 }, { wch: 14 },
    { wch: 22 }, { wch: 14 }, { wch: 14 },
  ];

  // Merges: title A1:N1, año A2:N2, Asignado a groups
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },  // title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },  // año
    { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },   // Núm rowspan
    { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },   // Última rowspan
    { s: { r: 3, c: 2 }, e: { r: 3, c: 4 } },   // Asignado a 1
    { s: { r: 3, c: 5 }, e: { r: 3, c: 7 } },   // Asignado a 2
    { s: { r: 3, c: 8 }, e: { r: 3, c: 10 } },  // Asignado a 3
    { s: { r: 3, c: 11 }, e: { r: 3, c: 13 } }, // Asignado a 4
  ];

  XLSX.utils.book_append_sheet(wb, ws, `S-13 ${year}`);
  XLSX.writeFile(wb, `S-13_${year}.xlsx`);
}

// S-13 DOCX — two header rows with spanning, 14 data columns
async function exportDocx(territories: Territory[], allAssignments: Assignment[], year: number) {
  const {
    Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
    WidthType, AlignmentType, HeadingLevel, VerticalAlign,
    ShadingType, TableLayoutType,
  } = await import('docx');

  const sorted = [...territories].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));

  const hdrShading = { type: ShadingType.SOLID, color: 'D5E3F0', fill: 'D5E3F0' };
  const hdrFont = { bold: true, size: 14 };

  const mkCell = (text: string, opts?: {
    bold?: boolean; size?: number; colSpan?: number; rowSpan?: number;
    shading?: boolean; center?: boolean; width?: number;
  }) => new TableCell({
    columnSpan: opts?.colSpan,
    rowSpan: opts?.rowSpan,
    shading: opts?.shading ? hdrShading : undefined,
    verticalAlign: VerticalAlign.CENTER,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    children: [new Paragraph({
      alignment: opts?.center ? AlignmentType.CENTER : undefined,
      children: [new TextRun({ text, bold: opts?.bold ?? false, size: opts?.size ?? 14 })],
    })],
  });

  const header1 = new TableRow({ tableHeader: true, children: [
    mkCell('Núm.\nde terr.', { bold: true, colSpan: 1, rowSpan: 2, shading: true, center: true, width: 700 }),
    mkCell('Última fecha en que se completó*', { bold: true, rowSpan: 2, shading: true, center: true, width: 1100 }),
    mkCell('Asignado a', { bold: true, colSpan: 3, shading: true, center: true }),
    mkCell('Asignado a', { bold: true, colSpan: 3, shading: true, center: true }),
    mkCell('Asignado a', { bold: true, colSpan: 3, shading: true, center: true }),
    mkCell('Asignado a', { bold: true, colSpan: 3, shading: true, center: true }),
  ]});

  const subLabels = ['Nombre', 'Fecha en que\nse asignó', 'Fecha en que\nse completó'];
  const header2 = new TableRow({ tableHeader: true, children: [
    ...subLabels, ...subLabels, ...subLabels, ...subLabels,
  ].map(t => mkCell(t, { shading: true, center: true }))});

  const dataRows = sorted.map(t => {
    const { lastCompleted, slots } = getSlots(t, allAssignments);
    const cells = [String(t.number ?? ''), fmt(lastCompleted), ...slots];
    return new TableRow({ children: cells.map((text, i) => mkCell(text, { center: i <= 1 })) });
  });

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 15840, height: 12240 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        new Paragraph({
          text: 'REGISTRO DE ASIGNACIÓN DE TERRITORIO',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ children: [new TextRun({ text: `Año de servicio:  ${year}`, size: 22 })] }),
        new Paragraph({ text: '' }),
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [header1, header2, ...dataRows],
        }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: '*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.', size: 14 })] }),
        new Paragraph({ children: [new TextRun({ text: 'S-13-S  1/22', size: 14 })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `S-13_${year}.docx`; a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TerritoriesPage() {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Export state
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Modo dibujo territorio
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LatLng[]>([]);
  const [form, setForm] = useState({ number: '', name: '', color: PALETTE[0], group_name: '' });

  // Modo dibujo límite congregación
  const [boundary, setBoundary] = useState<LatLng[] | null>(null);
  const [drawingBoundary, setDrawingBoundary] = useState(false);
  const [boundaryDraft, setBoundaryDraft] = useState<LatLng[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [tRes, uRes, bRes] = await Promise.all([
        fetch('/api/territories'),
        fetch('/api/users'),
        fetch('/api/congregation/boundary'),
      ]);
      const tJson = await tRes.json();
      const uJson = await uRes.json();
      const bJson = await bRes.json();
      if (tJson.migration_applied === false) setMigrationPending(true);
      setTerritories(tJson.territories || []);
      setUsers((uJson.users || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      setBoundary(bJson.boundary ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar territorios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchAssignments = useCallback(async (territoryId: string) => {
    const res = await fetch(`/api/territory-assignments?territory_id=${territoryId}`);
    const json = await res.json();
    setAssignments(json.assignments || []);
  }, []);

  const selected = territories.find(t => t.id === selectedId) || null;

  useEffect(() => {
    if (selectedId) fetchAssignments(selectedId);
    else setAssignments([]);
    setShowHistory(false);
  }, [selectedId, fetchAssignments]);

  // ── Dibujo ──────────────────────────────────────────────────────────────
  const startDraw = () => {
    setSelectedId(null);
    setDraft([]);
    setForm({ number: '', name: '', color: PALETTE[0], group_name: '' });
    setDrawing(true);
  };
  const cancelDraw = () => { setDrawing(false); setDraft([]); };
  const addVertex = (ll: LatLng) => setDraft(prev => [...prev, ll]);
  const undoVertex = () => setDraft(prev => prev.slice(0, -1));

  // ── Límite congregación ─────────────────────────────────────────────────
  const startBoundary = () => {
    setSelectedId(null);
    setDrawing(false);
    setDraft([]);
    setBoundaryDraft([]);
    setDrawingBoundary(true);
  };
  const cancelBoundary = () => { setDrawingBoundary(false); setBoundaryDraft([]); };
  const addBoundaryVertex = (ll: LatLng) => setBoundaryDraft(prev => [...prev, ll]);
  const saveBoundary = async () => {
    if (boundaryDraft.length < 3) { alert('Marca al menos 3 puntos para definir el límite.'); return; }
    const res = await fetch('/api/congregation/boundary', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boundary: boundaryDraft }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || 'No se pudo guardar'); return; }
    setBoundary(json.boundary);
    setDrawingBoundary(false);
    setBoundaryDraft([]);
  };
  const clearBoundary = async () => {
    if (!confirm('¿Eliminar el límite del territorio de la congregación?')) return;
    await fetch('/api/congregation/boundary', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boundary: null }) });
    setBoundary(null);
  };

  const saveTerritory = async () => {
    if (draft.length < 3) { alert('Marca al menos 3 puntos en el mapa para cerrar el territorio.'); return; }
    if (!form.name.trim()) { alert('Ponle un nombre al territorio.'); return; }
    const res = await fetch('/api/territories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: form.number ? Number(form.number) : null,
        name: form.name.trim(),
        color: form.color,
        coordinates: draft,
        group_name: form.group_name.trim() || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { alert(json.error || 'No se pudo guardar'); return; }
    setDrawing(false);
    setDraft([]);
    await fetchAll();
    setSelectedId(json.territory?.id || null);
  };

  // ── Edición / asignación ────────────────────────────────────────────────
  const patchSelected = async (patch: Partial<Territory>) => {
    if (!selected) return;
    setTerritories(prev => prev.map(t => t.id === selected.id ? { ...t, ...patch } : t));
    const res = await fetch(`/api/territories/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const json = await res.json();
      setTerritories(prev => prev.map(t => t.id === selected.id
        ? { ...json.territory, assigned_name: users.find(u => u.id === json.territory.assigned_to)?.name || null }
        : t));
      // Refresh assignments history after any patch
      await fetchAssignments(selected.id);
    }
  };

  const completeAndRelease = async () => {
    if (!selected) return;
    const today = new Date().toISOString().slice(0, 10);
    await patchSelected({ visit_end: today, status: 'completed' });
    // Small delay then release
    setTimeout(async () => {
      await patchSelected({ assigned_to: null, visit_start: null, visit_end: null, status: 'available' });
    }, 300);
  };

  const deleteAssignment = async (aId: string) => {
    if (!confirm('¿Eliminar este registro del historial?')) return;
    await fetch(`/api/territory-assignments/${aId}`, { method: 'DELETE' });
    if (selectedId) await fetchAssignments(selectedId);
  };

  const deleteTerritory = async (id: string) => {
    if (!confirm('¿Eliminar este territorio?')) return;
    await fetch(`/api/territories/${id}`, { method: 'DELETE' });
    if (selectedId === id) setSelectedId(null);
    await fetchAll();
  };

  // ── S-13 Export ─────────────────────────────────────────────────────────
  const handleExport = async (format: 'pdf' | 'xlsx' | 'docx') => {
    setExportOpen(false);
    setExporting(true);
    try {
      const year = currentServiceYear();
      // Fetch all assignments for all territories
      const res = await fetch('/api/territory-assignments');
      const json = await res.json();
      const allAssignments: Assignment[] = json.assignments || [];

      if (format === 'pdf') await exportPdf(territories, allAssignments, year);
      else if (format === 'xlsx') await exportXlsx(territories, allAssignments, year);
      else await exportDocx(territories, allAssignments, year);
    } catch (e) {
      alert('Error al exportar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-gray-900 dark:text-gray-100 text-sm pb-[52px] md:pb-0">
      <IconSidebar />
      <SyncStatus />

      {/* Panel izquierdo: lista + edición */}
      <div className="w-full md:w-80 max-h-[45vh] md:max-h-none flex-shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        {/* Header — only map/boundary actions, no overflow */}
        <div className="px-3 py-2.5 border-b border-slate-200 dark:border-gray-700 flex items-center gap-2">
          <h1 className="font-bold text-slate-800 dark:text-gray-100 flex items-center gap-1.5 mr-auto"><MapPin size={16} className="text-sky-600" /> Territorios</h1>
          {!drawing && !drawingBoundary && (
            <button onClick={startDraw} className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium px-2 py-1.5 rounded-lg">
              <Plus size={13} /> Nuevo
            </button>
          )}
          {!drawing && !drawingBoundary && (
            <button onClick={startBoundary} title="Definir límite"
              className="flex items-center gap-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-medium px-2 py-1.5 rounded-lg">
              <SquareDashed size={13} /> Límite
            </button>
          )}
          {!drawing && !drawingBoundary && boundary && (
            <button onClick={clearBoundary} title="Eliminar límite" className="text-slate-400 hover:text-red-500 px-1">
              <X size={13} />
            </button>
          )}
        </div>

        {migrationPending && (
          <div className="m-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 text-xs">
            Tabla <code>territories</code> no existe aún. Ejecuta <code>sql/territories_schema.sql</code> en el SQL Editor de Supabase y recarga.
          </div>
        )}
        {error && <div className="m-3 p-2 rounded bg-red-50 dark:bg-red-950/30 text-red-700 text-xs">{error}</div>}

        {/* Panel dibujo límite */}
        {drawingBoundary && (
          <div className="m-3 p-3 rounded-lg border border-slate-300 bg-slate-50 dark:bg-gray-700 space-y-2">
            <p className="text-xs text-slate-700 dark:text-gray-200 flex items-center gap-1.5 font-medium">
              <SquareDashed size={13} /> Marca el límite del territorio de la congregación ({boundaryDraft.length} puntos)
            </p>
            <p className="text-[11px] text-slate-500">Este polígono se mostrará en gris punteado como referencia visual.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setBoundaryDraft(prev => prev.slice(0, -1))} disabled={!boundaryDraft.length} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"><Undo2 size={13} /> Deshacer</button>
              <button onClick={saveBoundary} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-slate-600 hover:bg-slate-700 text-white"><Save size={13} /> Guardar</button>
              <button onClick={cancelBoundary} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200"><X size={13} /> Cancelar</button>
            </div>
          </div>
        )}

        {/* Formulario de dibujo */}
        {drawing && (
          <div className="m-3 p-3 rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-950/30 space-y-2">
            <p className="text-xs text-sky-800 flex items-center gap-1.5 font-medium">
              <Crosshair size={13} /> Haz clic en el mapa para marcar el polígono ({draft.length} puntos)
            </p>
            <div className="flex gap-2">
              <input value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="N°" inputMode="numeric"
                className="w-14 border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm" />
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre del territorio"
                className="flex-1 border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm" />
            </div>
            <input value={form.group_name} onChange={e => setForm({ ...form, group_name: e.target.value })} placeholder="Grupo (opcional)"
              className="w-full border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm" />
            <div className="flex gap-1.5">
              {PALETTE.map(c => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className={`w-5 h-5 rounded-full border-2 ${form.color === c ? 'border-slate-800' : 'border-white'}`} style={{ background: c }} />
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={undoVertex} disabled={!draft.length} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"><Undo2 size={13} /> Deshacer</button>
              <button onClick={saveTerritory} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white"><Check size={13} /> Guardar</button>
              <button onClick={cancelDraw} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded bg-slate-100 hover:bg-slate-200"><X size={13} /> Cancelar</button>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-slate-400 text-center text-xs">Cargando…</p>
          ) : territories.length === 0 && !drawing ? (
            <p className="p-4 text-slate-400 text-center text-xs">Sin territorios. Crea el primero con "Nuevo".</p>
          ) : (
            territories.map(t => (
              <button key={t.id} onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-4 py-2.5 border-b border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700 flex items-center gap-2.5 ${selectedId === t.id ? 'bg-sky-50 dark:bg-sky-950/30' : ''}`}>
                <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: t.color }} />
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-slate-800 dark:text-gray-100 truncate block">{t.number != null ? `${t.number}. ` : ''}{t.name}</span>
                  {t.assigned_name && <span className="text-[11px] text-slate-500">{t.assigned_name}</span>}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              </button>
            ))
          )}
        </div>

        {/* S-13 Export — footer strip (avoids header overflow) */}
        {!drawing && !drawingBoundary && territories.length > 0 && (
          <div className="border-t border-slate-200 dark:border-gray-700 px-3 py-2 bg-slate-50 dark:bg-gray-800/60 relative">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex-1">Reporte S-13</span>
              {[
                { fmt: 'pdf' as const, icon: <FileText size={12} />, label: 'PDF' },
                { fmt: 'xlsx' as const, icon: <FileSpreadsheet size={12} />, label: 'XLSX' },
                { fmt: 'docx' as const, icon: <FileText size={12} />, label: 'DOCX' },
              ].map(opt => (
                <button
                  key={opt.fmt}
                  onClick={() => handleExport(opt.fmt)}
                  disabled={exporting}
                  className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white"
                >
                  {opt.icon} {exporting ? '…' : opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detalle del seleccionado */}
        {selected && !drawing && (
          <div className="border-t border-slate-200 dark:border-gray-700 p-3 space-y-2 bg-slate-50 dark:bg-gray-800/50 overflow-y-auto max-h-[55vh] md:max-h-none">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-gray-100">{selected.number != null ? `${selected.number}. ` : ''}{selected.name}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowHistory(h => !h)}
                  title="Historial de asignaciones"
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${showHistory ? 'bg-sky-100 text-sky-700' : 'text-slate-400 hover:text-sky-600'}`}
                >
                  <History size={13} /> {assignments.length > 0 && <span className="font-medium">{assignments.length}</span>}
                </button>
                <button onClick={() => deleteTerritory(selected.id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></button>
              </div>
            </div>

            {/* Historial S-13 */}
            {showHistory && (
              <div className="rounded-lg border border-slate-200 dark:border-gray-600 overflow-hidden">
                <div className="bg-slate-100 dark:bg-gray-700 px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                  Historial S-13
                </div>
                {assignments.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-slate-400">Sin registros aún</p>
                ) : (
                  assignments.map((a, i) => (
                    <div key={a.id} className="flex items-start gap-2 px-3 py-1.5 border-t border-slate-100 dark:border-gray-700 first:border-0">
                      <span className="text-[10px] text-slate-400 w-4 shrink-0">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-gray-100 truncate">{a.assigned_name}</p>
                        <p className="text-[10px] text-slate-500">
                          {fmt(a.assigned_date)} → {a.completed_date ? fmt(a.completed_date) : <span className="text-amber-500">En curso</span>}
                        </p>
                      </div>
                      <button onClick={() => deleteAssignment(a.id)} className="text-slate-300 hover:text-red-500 shrink-0"><X size={11} /></button>
                    </div>
                  ))
                )}
              </div>
            )}

            <label className="block text-[11px] text-slate-500">Asignar a
              <select value={selected.assigned_to || ''} onChange={e => patchSelected({ assigned_to: e.target.value || null, status: e.target.value ? 'assigned' : 'available', visit_start: e.target.value ? (selected.visit_start || new Date().toISOString().slice(0, 10)) : null })}
                className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
                <option value="">— sin asignar —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>

            <div className="flex gap-2">
              <label className="flex-1 text-[11px] text-slate-500">Desde
                <input type="date" value={selected.visit_start || ''} onChange={e => patchSelected({ visit_start: e.target.value || null })}
                  className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs bg-white dark:bg-gray-800" />
              </label>
              <label className="flex-1 text-[11px] text-slate-500">Hasta
                <input type="date" value={selected.visit_end || ''} onChange={e => patchSelected({ visit_end: e.target.value || null })}
                  className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs bg-white dark:bg-gray-800" />
              </label>
            </div>

            {/* Completar y liberar button */}
            {selected.assigned_to && (
              <button
                onClick={completeAndRelease}
                className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <Check size={13} /> Completar y liberar territorio
              </button>
            )}

            <label className="block text-[11px] text-slate-500">Estado
              <select value={selected.status} onChange={e => patchSelected({ status: e.target.value as Territory['status'] })}
                className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800">
                <option value="available">Disponible</option>
                <option value="assigned">Asignado</option>
                <option value="completed">Completado</option>
              </select>
            </label>

            <label className="block text-[11px] text-slate-500">Nota
              <textarea value={selected.note || ''} onChange={e => patchSelected({ note: e.target.value || null })} rows={2}
                className="w-full mt-0.5 border border-slate-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 resize-none" />
            </label>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="flex-1 relative" onClick={() => exportOpen && setExportOpen(false)}>
        <TerritoryMap
          territories={territories}
          selectedId={selectedId}
          drawing={drawing || drawingBoundary}
          draftCoords={drawingBoundary ? boundaryDraft : draft}
          draftColor={drawingBoundary ? '#6b7280' : form.color}
          onMapClick={drawingBoundary ? addBoundaryVertex : addVertex}
          onSelect={setSelectedId}
          boundary={boundary}
          drawingBoundary={drawingBoundary}
        />
      </div>
    </div>
  );
}
