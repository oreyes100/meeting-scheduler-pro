'use client';

import React, { useMemo, useState } from 'react';
import { X, Printer, FileText } from 'lucide-react';

const TEAL = '#3d7d8e';
const TEAL_HEX = '3D7D8E';

interface Props {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | null | undefined)[][];
  getCardHTML: (row: (string | null | undefined)[], index: number) => string;
  onClose: () => void;
  dateColumn?: number;
  accentColor?: string;
  accentBg?: string;
  fileName?: string;
  meta?: string;
  emptyMessage?: string;
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function monthFromDate(val: string | null | undefined): string | null {
  if (!val) return null;
  const m = val.toString().match(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function ModulePrintModal({
  title,
  subtitle,
  columns,
  rows,
  getCardHTML,
  onClose,
  dateColumn,
  accentColor = 'sky',
  accentBg = TEAL,
  fileName = 'reporte',
  meta,
  emptyMessage = 'Sin datos',
}: Props) {
  const [layout, setLayout] = useState<'cards' | 'table'>('cards');

  const months = useMemo(() => {
    if (dateColumn === undefined) return [];
    const set = new Set<string>();
    for (const r of rows) {
      const m = monthFromDate(r[dateColumn]);
      if (m) set.add(m);
    }
    return Array.from(set).sort();
  }, [rows, dateColumn]);

  const [month, setMonth] = useState<string>(() => {
    const upcoming = rows.find(r => dateColumn !== undefined && r[dateColumn] && r[dateColumn]! >= new Date().toISOString().slice(0, 10));
    if (upcoming && dateColumn !== undefined) return monthFromDate(upcoming[dateColumn]) || '';
    return months[0] || '';
  });

  const filteredRows = useMemo(() => {
    if (dateColumn === undefined || !month) return rows;
    return rows.filter(r => monthFromDate(r[dateColumn]) === month);
  }, [rows, month, dateColumn]);

  const monthTitle = useMemo(() => {
    if (!month) return '';
    const d = new Date(month + '-01T00:00:00');
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }, [month]);

  const accentBtn = `bg-${accentColor}-600 hover:bg-${accentColor}-700`;
  const accentBtnActive = `${accentColor === 'sky' ? 'bg-sky-600' : accentColor === 'purple' ? 'bg-purple-600' : accentColor === 'green' ? 'bg-green-600' : accentColor === 'slate' ? 'bg-slate-600' : accentColor === 'cyan' ? 'bg-cyan-600' : accentColor === 'red' ? 'bg-red-600' : accentColor === 'indigo' ? 'bg-indigo-600' : accentColor === 'orange' ? 'bg-orange-600' : 'bg-sky-600'} text-white`;
  const accentBgClass = `bg-${accentColor}-600`;
  const accentHover = `hover:bg-${accentColor}-700`;

  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const head = `<style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        h1{font-size:18px;margin:0}
        h2{font-size:14px;color:#555;margin:2px 0 16px;font-weight:normal;text-transform:capitalize}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:${accentBg};color:#fff}
        tr:nth-child(even) td{background:#eef4f6}
        .meta{font-size:11px;color:#444;margin-top:14px}
      </style>`;

    let bodyHTML: string;
    if (layout === 'cards') {
      const cards = filteredRows.map((r, i) => `<div style="break-inside:avoid;page-break-inside:avoid;border:0.5px solid #d1d5db;margin-bottom:12px">${getCardHTML(r, i)}</div>`).join('');
      bodyHTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1f2937">
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1f2937;padding-bottom:4px;margin-bottom:12px;font-weight:500;font-size:16px">
          <span>${esc(title)}</span><span>Cong. La Estación</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${cards}</div>
      </div>`;
    } else {
      const tableRows = filteredRows.map(r => `<tr>${r.map(c => `<td>${esc(c || '')}</td>`).join('')}</tr>`).join('');
      bodyHTML = `<h1>${esc(title)}</h1>
        ${subtitle ? `<h2>${esc(subtitle)}</h2>` : ''}
        <table><thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${tableRows || `<tr><td colspan="${columns.length}" style="text-align:center;color:#9ca3af;padding:32px">${esc(emptyMessage)}</td></tr>`}</tbody></table>
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}`;
    }

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${head}</head><body>${bodyHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const downloadWord = async () => {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType } = docx;

    const headerRow = new TableRow({
      children: columns.map(c => new TableCell({
        shading: { fill: TEAL_HEX },
        children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, color: 'FFFFFF', size: 18 })] })],
      })),
    });

    const bodyRows = filteredRows.map(r => new TableRow({
      children: r.map(v => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: v || '', size: 18 })] })],
      })),
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${title}`)] }),
          ...(subtitle ? [new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: subtitle, color: '555555' })] })] : []),
          new Paragraph({ children: [new TextRun('')] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
          ...(meta ? [new Paragraph({ children: [new TextRun({ text: meta, size: 16, color: '444444' })] })] : []),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className={`flex items-center justify-between px-4 py-3 ${accentBtnActive} text-white rounded-t-lg`}>
          <span className="font-bold text-sm">Imprimir — {title}</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          {months.length > 0 && (
            <>
              <label className="text-xs text-gray-500 dark:text-gray-400">Mes</label>
              <select className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1 text-sm" value={month} onChange={e => setMonth(e.target.value)}>
                {months.map(mm => {
                  const d = new Date(mm + '-01T00:00:00');
                  return <option key={mm} value={mm}>{d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</option>;
                })}
              </select>
            </>
          )}
          <div className="flex items-center gap-1 ml-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">Diseño</span>
            <button onClick={() => setLayout('cards')} className={`px-2 py-1 text-xs rounded ${layout === 'cards' ? accentBtnActive : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Tarjetas</button>
            <button onClick={() => setLayout('table')} className={`px-2 py-1 text-xs rounded ${layout === 'table' ? accentBtnActive : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Tabla</button>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={printPdf} className={`flex items-center gap-1 px-3 py-1.5 ${accentBtnActive} text-xs rounded font-medium`}>
              <Printer size={13} /> Imprimir / PDF
            </button>
            <button onClick={downloadWord} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded font-medium">
              <FileText size={13} /> Descargar Word
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-900">
          {layout === 'cards' ? (
            <div className="bg-white mx-auto shadow p-6" style={{ maxWidth: 800 }}>
              <div className="flex items-end justify-between border-b-2 border-slate-800 pb-1 mb-3">
                <h1 className="text-lg font-bold text-gray-900">{title}</h1>
                <span className="text-lg font-bold text-gray-900">La Estación</span>
              </div>
              {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
              {monthTitle && <p className="text-sm text-gray-500 mb-4 capitalize">{monthTitle}</p>}
              <div className="grid grid-cols-2 gap-4">
                {filteredRows.length === 0 ? (
                  <p className="text-center text-gray-400 col-span-2 py-8">{emptyMessage}</p>
                ) : filteredRows.map((r, i) => (
                  <div key={i} className="border border-gray-200 rounded overflow-hidden"
                    dangerouslySetInnerHTML={{ __html: getCardHTML(r, i) }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white mx-auto shadow p-6" style={{ maxWidth: 800, fontFamily: 'Arial, Helvetica, sans-serif' }}>
              <div className="flex items-end justify-between border-b-2 border-slate-800 pb-1 mb-3">
                <h1 className="text-lg font-bold text-gray-900">{title}</h1>
                <span className="text-lg font-bold text-gray-900">La Estación</span>
              </div>
              {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
              {monthTitle && <p className="text-sm text-gray-500 mb-4 capitalize">{monthTitle}</p>}
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr>{columns.map(c => <th key={c} className="border border-gray-300 text-white px-2 py-1 text-left" style={{ background: accentBg }}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={i} className="even:bg-[#eef4f6]">
                      {r.map((v, j) => <td key={j} className="border border-gray-300 px-2 py-1 text-gray-800">{v || ''}</td>)}
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr><td colSpan={columns.length} className="border border-gray-300 px-2 py-4 text-center text-gray-400">{emptyMessage}</td></tr>
                  )}
                </tbody>
              </table>
              {meta && <p className="text-[11px] text-gray-500 mt-3">{meta}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
