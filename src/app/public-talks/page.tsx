'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Users, Calendar, MapPin, BookOpen, Briefcase, Eye,
  Sun, Moon, ChevronLeft, ChevronRight, Plus, Trash2, Save, X, Mic, ClipboardList, Sparkles, Printer
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { printTableReport } from '@/lib/printReport';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';

const WEEK_COUNT = 40;

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function getSunday(mondayISO: string): Date {
  const d = new Date(mondayISO + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return d;
}

function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtWeek(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  const sun = getSunday(isoDate);
  const start = d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const end = sun.toLocaleDateString('es-MX', { day: '2-digit' });
  return `${start.slice(6, 10)}/${start.slice(3, 5)}/${start.slice(0, 2)}`;
}

function personName(p: any): string {
  if (!p) return '';
  return p.display_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

function buildWeeks(): string[] {
  const monday = getMonday(new Date());
  monday.setDate(monday.getDate() - 12 * 7); // 12 weeks back
  const weeks: string[] = [];
  for (let i = 0; i < WEEK_COUNT; i++) {
    weeks.push(fmtISO(monday));
    monday.setDate(monday.getDate() + 7);
  }
  return weeks;
}

type Tab = 'locales' | 'salientes';

export default function PublicTalksPage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [tab, setTab] = useState<Tab>('locales');
  const [weekMeetings, setWeekMeetings] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [speakers, setSpeakers] = useState<any[]>([]); // can_be_speaker
  const [selected, setSelected] = useState<any | null>(null);
  const [editOutgoing, setEditOutgoing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const weeks = buildWeeks();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, oRes, pRes] = await Promise.all([
        fetch('/api/weekend-meetings'),
        fetch('/api/outgoing-talks'),
        fetch('/api/users'),
      ]);
      const wData = await wRes.json();
      const oData = await oRes.json();
      const pData = await pRes.json();
      setWeekMeetings(wData.meetings || []);
      setOutgoing(oData.talks || []);
      const allUsers = pData.users || [];
      setPublishers(allUsers);
      setSpeakers(allUsers.filter((u: any) => u.can_be_speaker));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const todayISO = fmtISO(getMonday(new Date()));

  // Locales: find meeting by week date (sunday of that week)
  const meetingForWeek = (mondayISO: string): any | null => {
    const sun = fmtISO(getSunday(mondayISO));
    return weekMeetings.find(m => m.date === sun || m.date === mondayISO) || null;
  };

  // Outgoing: map by week → list of talks
  const outgoingForWeek = (mondayISO: string, userId: string): any | null =>
    outgoing.find(t => t.week_date === mondayISO && t.user_id === userId) || null;

  const addOutgoing = async (weekDate: string, userId: string) => {
    const res = await fetch('/api/outgoing-talks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_date: weekDate, user_id: userId, congregation_name: '' }),
    });
    if (res.ok) { const j = await res.json(); setOutgoing(prev => [...prev, j.talk]); }
  };

  const updateOutgoing = async (t: any) => {
    await fetch(`/api/outgoing-talks/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    });
    setOutgoing(prev => prev.map(x => x.id === t.id ? t : x));
    setEditOutgoing(null);
  };

  const deleteOutgoing = async (id: string) => {
    await fetch(`/api/outgoing-talks/${id}`, { method: 'DELETE' });
    setOutgoing(prev => prev.filter(x => x.id !== id));
    setEditOutgoing(null);
  };

  const printReport = () => {
    if (tab === 'locales') {
      const rows = weeks.map(week => {
        const m = meetingForWeek(week);
        const speakerName = m?.speaker_type === 'visiting'
          ? (m?.visiting_speaker?.name || m?.visiting_speaker?.full_name || '')
          : personName(m?.local_speaker);
        const congregation = m?.speaker_type === 'visiting' ? (m?.visiting_speaker?.congregation_name || '') : (m ? 'Local' : '');
        return [
          fmtISO(getSunday(week)), speakerName, congregation,
          m?.outline?.title || m?.public_talk_title || '',
          personName(m?.chairman), personName(m?.wt_reader),
          m?.hospitality_group || personName(m?.hospitality_person) || '',
        ];
      });
      printTableReport({ title: 'Programa de Discursos Públicos', congName: 'Congregación', columns: ['Fecha', 'Orador', 'Congregación', 'Discurso público', 'Presidente', 'Lector', 'Hospitalidad'], rows });
    } else {
      const rows = weeks.map(week => [
        fmtISO(getSunday(week)),
        ...speakers.map(s => { const t = outgoingForWeek(week, s.id); return t ? (t.congregation_name || '—') : ''; }),
      ]);
      printTableReport({ title: 'Discursos Públicos Salientes', congName: 'Congregación', columns: ['Fin de semana', ...speakers.map(s => `${s.first_name} ${s.last_name}`)], rows });
    }
  };

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `w-full border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;
  const trHover = isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50';
  const thCls = `border p-2 text-left text-xs font-bold ${isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-700 border-gray-200'}`;
  const tdCls = `border p-1.5 text-xs ${isDark ? 'border-gray-700' : 'border-gray-200'}`;

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />
      <SyncStatus />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Discursos Públicos</h1>
          <div className="flex gap-2">
            <button onClick={() => setTab('locales')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'locales' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Locales</button>
            <button onClick={() => setTab('salientes')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'salientes' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Salientes</button>
            <button onClick={printReport} className="p-1.5 hover:bg-white/10 rounded" title="Imprimir"><Printer size={18} /></button>
          </div>
        </div>

        {tab === 'locales' ? (
          /* ── LOCALES: list of incoming public talk weeks ── */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={thCls}>Fecha</th>
                    <th className={thCls}>Orador</th>
                    <th className={thCls}>Congregación</th>
                    <th className={thCls}>Discurso público</th>
                    <th className={thCls}>Presidente</th>
                    <th className={thCls}>Lector de La Atalaya</th>
                    <th className={thCls}>Oración final</th>
                    <th className={thCls}>Hospitalidad</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(week => {
                    const m = meetingForWeek(week);
                    const sun = fmtISO(getSunday(week));
                    const isToday = week === todayISO;
                    const speaker = m?.local_speaker || m?.visiting_speaker;
                    const speakerName = m?.speaker_type === 'visiting'
                      ? (m?.visiting_speaker?.name || m?.visiting_speaker?.full_name || '')
                      : personName(m?.local_speaker);
                    const congregation = m?.speaker_type === 'visiting'
                      ? (m?.visiting_speaker?.congregation_name || '')
                      : 'Local';

                    return (
                      <tr key={week}
                          className={`cursor-pointer ${trHover} ${isToday ? (isDark ? 'bg-yellow-900/40' : 'bg-yellow-100') : ''} ${selected?.date === sun ? (isDark ? 'bg-teal-900/30' : 'bg-teal-50') : ''}`}
                          onClick={() => setSelected(m || { date: sun, week })}>
                        <td className={tdCls + ' font-mono'}>{sun}</td>
                        <td className={tdCls}>{speakerName}</td>
                        <td className={tdCls}>{m?.speaker_type === 'local' ? '—' : congregation}</td>
                        <td className={tdCls}>{m?.outline?.title || m?.public_talk_title || ''}</td>
                        <td className={tdCls}>{personName(m?.chairman)}</td>
                        <td className={tdCls}>{personName(m?.wt_reader)}</td>
                        <td className={tdCls}></td>
                        <td className={tdCls}>
                          {m?.hospitality_group || personName(m?.hospitality_person) || (m?.hospitality ? '✓' : '')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selected && (
              <div className={`w-full md:w-[280px] max-h-[45vh] md:max-h-none border-l ${bgCard} p-4 overflow-y-auto shrink-0`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">{selected.date}</h3>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
                <p className="text-xs text-gray-500 mb-2">Para editar el discurso ve a la sección <button className="text-teal-600 underline" onClick={() => router.push('/weekend')}>Fin de Semana</button>.</p>
                {selected.outline && <div className="text-sm font-medium mb-1">{selected.outline.title}</div>}
                {selected.chairman && <div className="text-xs text-gray-500">Presidente: {personName(selected.chairman)}</div>}
                {selected.wt_reader && <div className="text-xs text-gray-500">Lector: {personName(selected.wt_reader)}</div>}
              </div>
            )}
          </div>
        ) : (
          /* ── SALIENTES: speakers as columns, weeks as rows ── */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            <div className="flex-1 overflow-auto p-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold">Discursos Públicos Salientes</h2>
                <button onClick={() => setEditOutgoing({ week_date: todayISO, user_id: '', congregation_name: '' })}
                        className="bg-teal-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-teal-700 flex items-center gap-1">
                  <Plus size={14} /> Agregar
                </button>
              </div>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={`${thCls} w-28`}>Fin de semana</th>
                    {speakers.map(s => (
                      <th key={s.id} className={thCls}>{s.first_name} {s.last_name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(week => {
                    const isToday = week === todayISO;
                    return (
                      <tr key={week} className={`${trHover} ${isToday ? (isDark ? 'bg-yellow-900/40' : 'bg-yellow-100') : ''}`}>
                        <td className={tdCls + ' font-mono'}>{fmtISO(getSunday(week))}</td>
                        {speakers.map(s => {
                          const t = outgoingForWeek(week, s.id);
                          return (
                            <td key={s.id} className={`${tdCls} text-center cursor-pointer`}
                                onClick={() => t ? setEditOutgoing({ ...t }) : addOutgoing(week, s.id)}>
                              {t ? (
                                <span className="text-teal-700 font-medium text-xs">{t.congregation_name || '—'}</span>
                              ) : (
                                <span className="text-gray-200 dark:text-gray-700">·</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {editOutgoing && (
              <div className={`w-full md:w-[280px] max-h-[45vh] md:max-h-none border-l ${bgCard} p-4 overflow-y-auto shrink-0`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">Discurso Saliente</h3>
                  <button onClick={() => setEditOutgoing(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>

                <label className="block text-xs font-medium mb-1">Semana</label>
                <input type="date" className={inputCls} value={editOutgoing.week_date || ''}
                       onChange={e => setEditOutgoing({ ...editOutgoing, week_date: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Orador</label>
                <select className={inputCls} value={editOutgoing.user_id || ''}
                        onChange={e => setEditOutgoing({ ...editOutgoing, user_id: e.target.value })}>
                  <option value=""></option>
                  {speakers.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>

                <label className="block text-xs font-medium mb-1 mt-2">Congregación</label>
                <input className={inputCls} value={editOutgoing.congregation_name || ''}
                       onChange={e => setEditOutgoing({ ...editOutgoing, congregation_name: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Nº Discurso</label>
                <input type="number" className={inputCls} value={editOutgoing.talk_number || ''}
                       onChange={e => setEditOutgoing({ ...editOutgoing, talk_number: parseInt(e.target.value) || null })} />

                <label className="block text-xs font-medium mb-1 mt-2">Notas</label>
                <textarea className={inputCls} rows={2} value={editOutgoing.notes || ''}
                          onChange={e => setEditOutgoing({ ...editOutgoing, notes: e.target.value })} />

                <div className="flex gap-2 mt-4">
                  <button onClick={() => editOutgoing.id ? updateOutgoing(editOutgoing) : (async () => {
                    const res = await fetch('/api/outgoing-talks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editOutgoing) });
                    if (res.ok) { const j = await res.json(); setOutgoing(prev => [...prev, j.talk]); setEditOutgoing(null); }
                  })()}
                          className="flex-1 bg-teal-600 text-white text-xs py-1.5 rounded font-medium hover:bg-teal-700 flex items-center justify-center gap-1">
                    <Save size={14} /> Guardar
                  </button>
                  {editOutgoing.id && (
                    <button onClick={() => deleteOutgoing(editOutgoing.id)} className="bg-red-100 text-red-700 text-xs py-1.5 px-3 rounded hover:bg-red-200">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
