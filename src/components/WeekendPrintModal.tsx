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
    const rows = monthMeetings.map(m => rowOf(m, locale));
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${congName} — ${monthTitle}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
        h1{font-size:18px;margin:0}
        h2{font-size:14px;color:#555;margin:2px 0 16px;font-weight:normal}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#1e6fd9;color:#fff}
        tr:nth-child(even) td{background:#f4f8ff}
        .meta{font-size:11px;color:#444;margin-top:14px}
      </style></head><body>
      <h1>${congName} — Programa de Discursos Públicos</h1>
      <h2>${monthTitle}${congregation?.kingdom_hall_address ? ' · ' + congregation.kingdom_hall_address : ''}</h2>
      <table><thead><tr>${COLS.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${(c || '').replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')}</tbody></table>
      ${congregation?.co_name ? `<div class="meta">Superintendente de circuito: ${congregation.co_name}</div>` : ''}
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const downloadWord = async () => {
    const docx = await import('docx');
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType } = docx;

    const headerRow = new TableRow({
      children: COLS.map(c => new TableCell({
        shading: { fill: '1E6FD9' },
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
          <div className="bg-white mx-auto shadow p-6" style={{ maxWidth: 800 }}>
            <h1 className="text-lg font-bold text-gray-900">{congName} — Programa de Discursos Públicos</h1>
            <p className="text-sm text-gray-500 mb-4 capitalize">{monthTitle}{congregation?.kingdom_hall_address ? ` · ${congregation.kingdom_hall_address}` : ''}</p>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr>{COLS.map(c => <th key={c} className="border border-gray-300 bg-sky-600 text-white px-2 py-1 text-left">{c}</th>)}</tr>
              </thead>
              <tbody>
                {monthMeetings.map(m => (
                  <tr key={m.id} className="even:bg-sky-50">
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
        </div>
      </div>
    </div>
  );
}
