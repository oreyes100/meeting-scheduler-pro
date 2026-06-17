'use client';

import React, { useMemo, useState } from 'react';
import { X, Printer, FileText } from 'lucide-react';

interface TaskDef { key: string; label: string; slots: number; }

interface Props {
  tasks: TaskDef[];
  assignmentsByWeek: Record<string, any>; // mondayISO -> { taskKey: string[] }
  publishers: any[];
  congName: string;
  congAddress?: string;
  onClose: () => void;
}

const TEAL = '#3d7d8e';
const TEAL_HEX = '3D7D8E';
const AMBER = '#c9a227';

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
function fmtISO(d: Date): string { return d.toISOString().slice(0, 10); }

function weekRange(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00');
  const sun = new Date(d); sun.setDate(sun.getDate() + 6);
  const mo = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  const su = sun.toLocaleDateString('es-MX', { day: 'numeric' });
  return `${mo}-${su}`;
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Mondays whose month (of the Monday) matches yyyy-mm
function mondaysInMonth(yyyymm: string): string[] {
  const [y, m] = yyyymm.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const out: string[] = [];
  let cur = getMonday(first);
  // walk forward until past the month
  const end = new Date(y, m, 0); // last day of month
  while (cur <= end) {
    if (cur >= first) out.push(fmtISO(cur));
    cur = new Date(cur); cur.setDate(cur.getDate() + 7);
  }
  return out;
}

export function TasksPrintModal({ tasks, assignmentsByWeek, publishers, congName, congAddress, onClose }: Props) {
  const [layout, setLayout] = useState<'cards' | 'table'>('table');
  const [month, setMonth] = useState<string>(() => fmtISO(getMonday(new Date())).slice(0, 7));

  const userById = (id: string) => publishers.find(p => p.id === id);
  const nameOf = (id: string) => {
    const u = userById(id);
    return u ? `${u.first_name} ${u.last_name}`.trim() : '';
  };

  // Months from saved weeks + current month, sorted
  const months = useMemo(() => {
    const set = new Set<string>(Object.keys(assignmentsByWeek).map(w => w.slice(0, 7)));
    set.add(fmtISO(getMonday(new Date())).slice(0, 7));
    return Array.from(set).sort();
  }, [assignmentsByWeek]);

  const weeks = useMemo(() => mondaysInMonth(month), [month]);

  const monthTitle = useMemo(() => {
    const d = new Date(month + '-01T00:00:00');
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }, [month]);

  // Names for a (week, taskKey): join slots with " & "
  const cellNames = (weekISO: string, taskKey: string): string => {
    const a = assignmentsByWeek[weekISO] || {};
    const val = a[taskKey];
    const ids = Array.isArray(val) ? val : (typeof val === 'string' && val ? [val] : []);
    return ids.filter(Boolean).map(nameOf).filter(Boolean).join(' & ');
  };

  const COLS = ['Fecha', ...tasks.map(t => t.label)];

  // ── Card view ──────────────────────────────────────────────
  function cardRowsHTML(weekISO: string): string {
    return tasks.map((t, i) => {
      const sep = (i === 5) ? `<div style="height:3px;background:${AMBER};margin:4px 0"></div>` : '';
      return sep + `<div style="display:flex;padding:2px 0"><span style="width:130px;font-weight:500">${esc(t.label)}</span><span style="flex:1">${esc(cellNames(weekISO, t.key)) || '&mdash;'}</span></div>`;
    }).join('');
  }
  function cardHTML(weekISO: string): string {
    return `<div style="break-inside:avoid;page-break-inside:avoid;border:0.5px solid #d1d5db">
      <div style="display:flex;background:${TEAL};color:#fff;font-weight:500;padding:5px 8px">
        <span style="flex:1">Semana</span><span>${esc(weekRange(weekISO))}</span>
      </div>
      <div style="padding:6px 8px">${cardRowsHTML(weekISO)}</div>
    </div>`;
  }
  function cardsHTML(): string {
    if (!weeks.length) return '<p style="text-align:center;color:#9ca3af;padding:32px">Sin semanas este mes</p>';
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1f2937">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1f2937;padding-bottom:4px;margin-bottom:12px;font-weight:500;font-size:16px">
        <span>Tareas de la Congregación</span><span>Cong. ${esc(congName)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${weeks.map(cardHTML).join('')}</div>
    </div>`;
  }

  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const head = `<style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        h1{font-size:18px;margin:0}
        h2{font-size:14px;color:#555;margin:2px 0 16px;font-weight:normal;text-transform:capitalize}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:${TEAL};color:#fff}
        tr:nth-child(even) td{background:#eef4f6}
      </style>`;

    let bodyHTML: string;
    if (layout === 'cards') {
      bodyHTML = cardsHTML();
    } else {
      const rows = weeks.map(wk => [weekRange(wk), ...tasks.map(t => cellNames(wk, t.key))]);
      bodyHTML = `<h1>${esc(congName)} — Tareas de la Congregación</h1>
        <h2>${monthTitle}${congAddress ? ' · ' + esc(congAddress) : ''}</h2>
        <table><thead><tr>${COLS.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(congName)} — ${monthTitle}</title>${head}</head><body>${bodyHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const downloadWord = async () => {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType } = docx;

    const headerRow = new TableRow({
      children: COLS.map(c => new TableCell({
        shading: { fill: TEAL_HEX },
        children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, color: 'FFFFFF', size: 18 })] })],
      })),
    });
    const bodyRows = weeks.map(wk => new TableRow({
      children: [weekRange(wk), ...tasks.map(t => cellNames(wk, t.key))].map(v => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: v || '', size: 18 })] })],
      })),
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${congName} — Tareas de la Congregación`)] }),
          new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: monthTitle, color: '555555' })] }),
          new Paragraph({ children: [new TextRun('')] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tareas-${month}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-orange-600 text-white rounded-t-lg">
          <span className="font-bold text-sm">Imprimir Tareas del mes</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">Mes</label>
          <select className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1 text-sm" value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(mm => {
              const d = new Date(mm + '-01T00:00:00');
              return <option key={mm} value={mm}>{d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
          <div className="flex items-center gap-1 ml-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">Diseño</span>
            <button onClick={() => setLayout('cards')} className={`px-2 py-1 text-xs rounded ${layout === 'cards' ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Tarjetas</button>
            <button onClick={() => setLayout('table')} className={`px-2 py-1 text-xs rounded ${layout === 'table' ? 'bg-orange-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Tabla</button>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={printPdf} className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded font-medium">
              <Printer size={13} /> Imprimir / PDF
            </button>
            <button onClick={downloadWord} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded font-medium">
              <FileText size={13} /> Descargar Word
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900">
          {layout === 'cards' ? (
            <div className="bg-white mx-auto shadow p-6" style={{ maxWidth: 800 }}
              dangerouslySetInnerHTML={{ __html: cardsHTML() }} />
          ) : (
            <div className="bg-white mx-auto shadow p-6" style={{ maxWidth: 800, fontFamily: 'Arial, Helvetica, sans-serif' }}>
              <div className="flex items-end justify-between border-b-2 border-slate-800 pb-1 mb-3">
                <h1 className="text-lg font-bold text-gray-900">Tareas de la Congregación</h1>
                <span className="text-lg font-bold text-gray-900">{congName}</span>
              </div>
              <p className="text-sm text-gray-500 mb-4 capitalize">{monthTitle}{congAddress ? ` · ${congAddress}` : ''}</p>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr>{COLS.map(c => <th key={c} className="border border-gray-300 text-white px-2 py-1 text-left" style={{ background: TEAL }}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {weeks.map(wk => (
                    <tr key={wk} className="even:bg-[#eef4f6]">
                      <td className="border border-gray-300 px-2 py-1 text-gray-800 font-medium">{weekRange(wk)}</td>
                      {tasks.map(t => <td key={t.key} className="border border-gray-300 px-2 py-1 text-gray-800">{cellNames(wk, t.key)}</td>)}
                    </tr>
                  ))}
                  {weeks.length === 0 && (
                    <tr><td colSpan={COLS.length} className="border border-gray-300 px-2 py-4 text-center text-gray-400">Sin semanas este mes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
