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

// ── S-13 export helpers ──────────────────────────────────────────────────────

async function exportPdf(territories: Territory[], allAssignments: Assignment[], year: number) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('REGISTRO DE ASIGNACIÓN DE TERRITORIO', pageW / 2, 14, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Año de servicio: ${year}`, 14, 22);

  const head = [
    [
      { content: 'Núm.\nde terr.', rowSpan: 2 },
      { content: 'Última fecha\nen que se\ncompletó*', rowSpan: 2 },
      { content: 'Asignado a', colSpan: 2 },
      { content: 'Asignado a', colSpan: 2 },
      { content: 'Asignado a', colSpan: 2 },
      { content: 'Asignado a', colSpan: 2 },
    ],
    [
      'Fecha asignado', 'Fecha completado',
      'Fecha asignado', 'Fecha completado',
      'Fecha asignado', 'Fecha completado',
      'Fecha asignado', 'Fecha completado',
    ],
  ];

  const sorted = [...territories].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));

  const body = sorted.map(t => {
    const tas = allAssignments
      .filter(a => a.territory_id === t.id)
      .sort((a, b) => (a.assigned_date ?? '').localeCompare(b.assigned_date ?? ''));
    const lastCompleted = [...tas].reverse().find(a => a.completed_date)?.completed_date ?? null;
    const slots = [0, 1, 2, 3].flatMap(i => {
      const a = tas[i];
      return [a ? a.assigned_name + '\n' + fmt(a.assigned_date) : '', a ? fmt(a.completed_date) : ''];
    });
    return [t.number ?? '', fmt(lastCompleted), ...slots];
  });

  autoTable(doc, {
    head,
    body,
    startY: 26,
    styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.3, lineColor: [180, 180, 180] },
    headStyles: { fillColor: [220, 230, 240], textColor: [30, 30, 30], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center', cellWidth: 18 },
    },
    margin: { left: 10, right: 10 },
  });

  doc.setFontSize(6);
  doc.text('*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.', 10, doc.internal.pageSize.getHeight() - 8);
  doc.text('S-13-S 1/22', 10, doc.internal.pageSize.getHeight() - 4);

  doc.save(`S-13_${year}.pdf`);
}

async function exportXlsx(territories: Territory[], allAssignments: Assignment[], year: number) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const sorted = [...territories].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));

  const rows: (string | number)[][] = [
    ['REGISTRO DE ASIGNACIÓN DE TERRITORIO'],
    [`Año de servicio: ${year}`],
    [],
    [
      'Núm. de terr.', 'Última fecha en que se completó*',
      'Asignado a (1)', 'Fecha en que se asignó', 'Fecha en que se completó',
      'Asignado a (2)', 'Fecha en que se asignó', 'Fecha en que se completó',
      'Asignado a (3)', 'Fecha en que se asignó', 'Fecha en que se completó',
      'Asignado a (4)', 'Fecha en que se asignó', 'Fecha en que se completó',
    ],
    ...sorted.map(t => {
      const tas = allAssignments
        .filter(a => a.territory_id === t.id)
        .sort((a, b) => (a.assigned_date ?? '').localeCompare(b.assigned_date ?? ''));
      const lastCompleted = [...tas].reverse().find(a => a.completed_date)?.completed_date ?? '';
      const slots = [0, 1, 2, 3].flatMap(i => {
        const a = tas[i];
        return [a?.assigned_name ?? '', a?.assigned_date ?? '', a?.completed_date ?? ''];
      });
      return [t.number ?? '', lastCompleted, ...slots];
    }),
    [],
    ['*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.'],
    ['S-13-S 1/22'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 22 }, ...Array(12).fill({ wch: 20 })];
  XLSX.utils.book_append_sheet(wb, ws, `S-13 ${year}`);
  XLSX.writeFile(wb, `S-13_${year}.xlsx`);
}

async function exportDocx(territories: Territory[], allAssignments: Assignment[], year: number) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, HeadingLevel } = await import('docx');

  const sorted = [...territories].sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999));

  const headerRow = new TableRow({
    children: [
      'Núm. de terr.',
      'Última fecha completado*',
      'Asignado a (1)', 'Asignado', 'Completado',
      'Asignado a (2)', 'Asignado', 'Completado',
      'Asignado a (3)', 'Asignado', 'Completado',
      'Asignado a (4)', 'Asignado', 'Completado',
    ].map(text => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 16 })] })],
      width: { size: 700, type: WidthType.DXA },
    })),
  });

  const dataRows = sorted.map(t => {
    const tas = allAssignments
      .filter(a => a.territory_id === t.id)
      .sort((a, b) => (a.assigned_date ?? '').localeCompare(b.assigned_date ?? ''));
    const lastCompleted = [...tas].reverse().find(a => a.completed_date)?.completed_date ?? '';
    const cells = [
      String(t.number ?? ''),
      fmt(lastCompleted || null),
      ...([0, 1, 2, 3].flatMap(i => {
        const a = tas[i];
        return [a?.assigned_name ?? '', fmt(a?.assigned_date ?? null), fmt(a?.completed_date ?? null)];
      })),
    ];
    return new TableRow({
      children: cells.map(text => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, size: 16 })] })],
        width: { size: 700, type: WidthType.DXA },
      })),
    });
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: 'REGISTRO DE ASIGNACIÓN DE TERRITORIO',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ children: [new TextRun({ text: `Año de servicio: ${year}`, size: 22 })] }),
        new Paragraph({ text: '' }),
        new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        new Paragraph({ text: '' }),
        new Paragraph({ children: [new TextRun({ text: '*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.', size: 16 })] }),
        new Paragraph({ children: [new TextRun({ text: 'S-13-S 1/22', size: 16 })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `S-13_${year}.docx`;
  a.click();
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
        <div className="px-4 py-3 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between gap-2">
          <h1 className="font-bold text-slate-800 dark:text-gray-100 flex items-center gap-2"><MapPin size={18} className="text-sky-600" /> Territorios</h1>
          <div className="flex gap-1.5">
            {!drawing && !drawingBoundary && (
              <button onClick={startDraw} className="flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg">
                <Plus size={14} /> Nuevo
              </button>
            )}
            {!drawing && !drawingBoundary && (
              <button onClick={startBoundary} title="Definir límite de la congregación"
                className="flex items-center gap-1 bg-slate-500 hover:bg-slate-600 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg">
                <SquareDashed size={14} /> Límite
              </button>
            )}
            {!drawing && !drawingBoundary && boundary && (
              <button onClick={clearBoundary} title="Eliminar límite" className="text-slate-400 hover:text-red-500 px-1">
                <X size={14} />
              </button>
            )}
            {/* S-13 Export dropdown */}
            {!drawing && !drawingBoundary && (
              <div className="relative">
                <button
                  onClick={() => setExportOpen(prev => !prev)}
                  disabled={exporting || territories.length === 0}
                  title="Exportar S-13"
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg"
                >
                  {exporting ? '…' : <FileDown size={14} />}
                  <ChevronDown size={11} />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-lg shadow-lg min-w-[140px]">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Exportar S-13</p>
                    {[
                      { fmt: 'pdf' as const, icon: <FileText size={13} />, label: 'PDF' },
                      { fmt: 'xlsx' as const, icon: <FileSpreadsheet size={13} />, label: 'Excel (XLSX)' },
                      { fmt: 'docx' as const, icon: <FileText size={13} />, label: 'Word (DOCX)' },
                    ].map(opt => (
                      <button key={opt.fmt} onClick={() => handleExport(opt.fmt)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200">
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
