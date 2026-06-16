'use client';

import React, { useMemo, useState } from 'react';
import { X, Printer, FileText } from 'lucide-react';
import type { WeekendMeeting, CongregationSettings } from '@/types';
import { formatWeekRange } from '@/lib/weekLabel';

interface Props {
  meetings: WeekendMeeting[];
  congregation: CongregationSettings | null;
  locale: 'en' | 'es';
  onClose: () => void;
}

function personName(p: { first_name?: string | null; last_name?: string | null; display_name?: string | null } | null | undefined) {
  if (!p) return '';
  return p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ');
}

const HOSPITALITY_GROUPS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5'];

// Paleta compartida con el programa de entre semana (modelo La Estación).
const TEAL = '#3d7d8e';
const TEAL_HEX = '3D7D8E';
const AMBER = '#c9a227';
const MAROON = '#7c2230';

function fmtDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function speakerLabel(m: WeekendMeeting) {
  if (m.speaker_type === 'other') return m.other_speaker_name || '';
  if (m.speaker_type === 'visiting') return m.visiting_speaker?.name || '';
  return personName(m.local_speaker);
}
function congregationOf(m: WeekendMeeting) {
  if (m.speaker_type === 'visiting') return m.visiting_speaker?.congregation || '';
  if (m.speaker_type === 'local') return 'Local';
  return '';
}
function outlineLabel(m: WeekendMeeting) {
  if (m.special_talk_title) return m.special_talk_title;
  if (m.outline) return `${m.outline.number} - ${m.outline.title}`;
  return '';
}
function hospitalityLabel(m: WeekendMeeting) {
  return personName(m.hospitality_person) || (HOSPITALITY_GROUPS.includes(m.hospitality_text || '') ? m.hospitality_text! : '');
}

// ── Vista de tarjetas (modelo La Estación) ───────────────────────────────────
function cardRowsHTML(m: WeekendMeeting): string {
  const rows: ([string, string] | '__amber' | '__maroon')[] = [
    ['Presidente', personName(m.chairman)],
    ['Discurso', outlineLabel(m)],
    '__amber',
    ['Orador', speakerLabel(m)],
    ['Congregación', congregationOf(m)],
    ['Conductor', personName(m.wt_conductor)],
    ['Lector', personName(m.wt_reader)],
    '__maroon',
    ['Limpieza', m.cleaning_group || ''],
    ['Hospitalidad', hospitalityLabel(m)],
  ];
  return rows.map(r => {
    if (r === '__amber') return `<div style="height:3px;background:${AMBER};margin:4px 0"></div>`;
    if (r === '__maroon') return `<div style="height:3px;background:${MAROON};margin:4px 0"></div>`;
    return `<div style="display:flex;padding:2px 0"><span style="width:110px;font-weight:500">${esc(r[0])}</span><span style="flex:1">${esc(r[1]) || '&mdash;'}</span></div>`;
  }).join('');
}

function cardHTML(m: WeekendMeeting): string {
  return `<div style="break-inside:avoid;page-break-inside:avoid;border:0.5px solid #d1d5db">
    <div style="display:flex;background:${TEAL};color:#fff;font-weight:500;padding:5px 8px">
      <span style="flex:1">Domingo</span><span>${fmtDMY(m.date)}</span>
    </div>
    <div style="padding:6px 8px">${cardRowsHTML(m)}</div>
  </div>`;
}

function cardsHTML(meetings: WeekendMeeting[], congName: string): string {
  if (!meetings.length) return '<p style="text-align:center;color:#9ca3af;padding:32px">Sin reuniones este mes</p>';
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1f2937">
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #1f2937;padding-bottom:4px;margin-bottom:12px;font-weight:500;font-size:16px">
      <span>Reunión de fin de semana</span><span>Cong. ${esc(congName)}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">${meetings.map(cardHTML).join('')}</div>
  </div>`;
}

const COLS = ['Fecha', 'Orador', 'Congregación', 'Discurso', 'Canción', 'Presidente', 'Lector', 'Hospitalidad'];

function rowOf(m: WeekendMeeting, locale: 'en' | 'es'): string[] {
  return [
    formatWeekRange(m.date, locale),
    speakerLabel(m),
    congregationOf(m),
    outlineLabel(m),
    m.song ? String(m.song) : '',
    personName(m.chairman),
    personName(m.wt_reader),
    hospitalityLabel(m),
  ];
}

export function WeekendPrintModal({ meetings, congregation, locale, onClose }: Props) {
  const [layout, setLayout] = useState<'cards' | 'table'>('cards');
  const [month, setMonth] = useState<string>(() => {
    const upcoming = meetings.find(m => m.date >= new Date().toISOString().slice(0, 10));
    return (upcoming?.date || meetings[0]?.date || new Date().toISOString().slice(0, 10)).slice(0, 7);
  });

  const months = useMemo(() => {
    const set = new Set(meetings.map(m => m.date.slice(0, 7)));
    return Array.from(set).sort();
  }, [meetings]);

  const monthMeetings = useMemo(
    () => meetings.filter(m => m.date.slice(0, 7) === month).sort((a, b) => a.date.localeCompare(b.date)),
    [meetings, month],
  );

  const monthTitle = useMemo(() => {
    const d = new Date(month + '-01T00:00:00');
    return d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
  }, [month, locale]);

  const congName = congregation?.name || 'Congregación';

  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const head = `<style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        h1{font-size:18px;margin:0}
        h2{font-size:14px;color:#555;margin:2px 0 16px;font-weight:normal}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:${TEAL};color:#fff}
        tr:nth-child(even) td{background:#eef4f6}
        .meta{font-size:11px;color:#444;margin-top:14px}
      </style>`;

    let bodyHTML: string;
    if (layout === 'cards') {
      bodyHTML = cardsHTML(monthMeetings, congName);
    } else {
      const rows = monthMeetings.map(m => rowOf(m, locale));
      bodyHTML = `<h1>${congName} — Programa de Discursos Públicos</h1>
        <h2>${monthTitle}${congregation?.kingdom_hall_address ? ' · ' + congregation.kingdom_hall_address : ''}</h2>
        <table><thead><tr>${COLS.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${(c || '').replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')}</tbody></table>
        ${congregation?.co_name ? `<div class="meta">Superintendente de circuito: ${congregation.co_name}</div>` : ''}`;
    }

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${congName} — ${monthTitle}</title>${head}</head><body>${bodyHTML}</body></html>`);
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
    const bodyRows = monthMeetings.map(m => new TableRow({
      children: rowOf(m, locale).map(v => new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: v || '', size: 18 })] })],
      })),
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${congName} — Programa de Discursos Públicos`)] }),
          new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: monthTitle, color: '555555' })] }),
          new Paragraph({ children: [new TextRun('')] }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
          ...(congregation?.co_name ? [new Paragraph({ children: [new TextRun({ text: `Superintendente de circuito: ${congregation.co_name}`, size: 16, color: '444444' })] })] : []),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `programa-discursos-${month}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-sky-600 text-white rounded-t-lg">
          <span className="font-bold text-sm">Imprimir programa del mes</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <label className="text-xs text-gray-500 dark:text-gray-400">Mes</label>
          <select className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded px-2 py-1 text-sm" value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(mm => {
              const d = new Date(mm + '-01T00:00:00');
              return <option key={mm} value={mm}>{d.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
          <div className="flex items-center gap-1 ml-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">Diseño</span>
            <button onClick={() => setLayout('cards')} className={`px-2 py-1 text-xs rounded ${layout === 'cards' ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Tarjetas</button>
            <button onClick={() => setLayout('table')} className={`px-2 py-1 text-xs rounded ${layout === 'table' ? 'bg-sky-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>Tabla</button>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={printPdf} className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs rounded font-medium">
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
              dangerouslySetInnerHTML={{ __html: cardsHTML(monthMeetings, congName) }} />
          ) : (
          <div className="bg-white mx-auto shadow p-6" style={{ maxWidth: 800, fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div className="flex items-end justify-between border-b-2 border-slate-800 pb-1 mb-3">
              <h1 className="text-lg font-bold text-gray-900">Programa de Discursos Públicos</h1>
              <span className="text-lg font-bold text-gray-900">{congName}</span>
            </div>
            <p className="text-sm text-gray-500 mb-4 capitalize">{monthTitle}{congregation?.kingdom_hall_address ? ` · ${congregation.kingdom_hall_address}` : ''}</p>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr>{COLS.map(c => <th key={c} className="border border-gray-300 text-white px-2 py-1 text-left" style={{ background: TEAL }}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {monthMeetings.map(m => (
                  <tr key={m.id} className="even:bg-[#eef4f6]">
                    {rowOf(m, locale).map((v, i) => <td key={i} className="border border-gray-300 px-2 py-1 text-gray-800">{v || ''}</td>)}
                  </tr>
                ))}
                {monthMeetings.length === 0 && (
                  <tr><td colSpan={COLS.length} className="border border-gray-300 px-2 py-4 text-center text-gray-400">Sin reuniones este mes</td></tr>
                )}
              </tbody>
            </table>
            {congregation?.co_name && <p className="text-[11px] text-gray-500 mt-3">Superintendente de circuito: {congregation.co_name}</p>}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
