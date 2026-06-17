'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Users, Calendar, BookOpen, Briefcase, ClipboardList, Sparkles, Wrench, CalendarDays, Mic,
  Sun, Moon, ChevronLeft, ChevronRight, Plus, Trash2, Save, X
} from 'lucide-react';
import { useTheme } from '@/lib/theme';

const DAYS = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  tuesday: 'martes', wednesday: 'miércoles', thursday: 'jueves',
  friday: 'viernes', saturday: 'sábado', sunday: 'domingo',
};
const SLOTS = ['manana', 'almuerzo', 'tarde', 'cena', 'noche'];
const SLOT_LABELS: Record<string, string> = {
  manana: 'Mañana', almuerzo: 'Almuerzo', tarde: 'Tarde', cena: 'Cena', noche: 'Noche',
};

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
function fmtISO(d: Date): string { return d.toISOString().slice(0, 10); }
function weekLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const sun = new Date(d); sun.setDate(sun.getDate() + 6);
  return `${d.toLocaleDateString('es-MX', { month: 'long', day: 'numeric' })} - ${sun.toLocaleDateString('es-MX', { day: 'numeric' })}`;
}
function personName(p: any): string {
  if (!p) return '';
  return p.display_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

export default function CoVisitPage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [weekDate, setWeekDate] = useState(() => fmtISO(getMonday(new Date())));
  const [visit, setVisit] = useState<any | null>(null);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState<any>({ day: 'tuesday', slot: 'manana', title: '', time: '', location: '', notes: '' });

  const fetchData = useCallback(async () => {
    const [vRes, pRes] = await Promise.all([fetch('/api/co-visits'), fetch('/api/users')]);
    const vData = await vRes.json();
    const pData = await pRes.json();
    setPublishers(pData.users || []);
    const found = (vData.rows || []).find((v: any) => v.week_date === weekDate);
    setVisit(found || null);
    setDirty(false);
  }, [weekDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ensureVisit = async (): Promise<any> => {
    if (visit) return visit;
    const res = await fetch('/api/co-visits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_date: weekDate, activities: [], co_companions: [], wife_companions: [] }),
    });
    const j = await res.json();
    setVisit(j.row);
    return j.row;
  };

  const persist = async (v: any) => {
    await fetch(`/api/co-visits/${v.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) });
    setVisit(v);
    setDirty(false);
  };

  const addActivity = async () => {
    if (!draft.title) return;
    const v = await ensureVisit();
    const acts = Array.isArray(v.activities) ? [...v.activities] : [];
    acts.push({ ...draft, id: Date.now().toString() });
    const updated = { ...v, activities: acts };
    setVisit(updated);
    await persist(updated);
    setDraft({ day: 'tuesday', slot: 'manana', title: '', time: '', location: '', notes: '' });
  };

  const removeActivity = async (id: string) => {
    if (!visit) return;
    const updated = { ...visit, activities: (visit.activities || []).filter((a: any) => a.id !== id) };
    setVisit(updated);
    await persist(updated);
  };

  const navWeek = (dir: number) => {
    const d = new Date(weekDate + 'T00:00:00'); d.setDate(d.getDate() + dir * 7);
    setWeekDate(fmtISO(d));
  };

  const setField = (field: string, value: any) => {
    setVisit((prev: any) => ({ ...(prev || { week_date: weekDate }), [field]: value }));
    setDirty(true);
  };

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const bgCell = isDark ? 'bg-gray-800' : 'bg-white';
  const inputCls = `w-full border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;

  const activities = visit?.activities || [];
  const actFor = (day: string, slot: string) => activities.filter((a: any) => a.day === day && a.slot === slot);

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <div className={`w-[52px] ${isDark ? 'bg-gray-900' : 'bg-sky-500'} flex flex-col items-center py-3 gap-3 shrink-0`}>
        <button onClick={() => router.push('/congregation')} className="p-2 hover:bg-sky-600 rounded-md text-white"><Home size={24} /></button>
        <button onClick={() => router.push('/persons')} className="p-2 hover:bg-sky-600 rounded-md text-white"><Users size={24} /></button>
        <button onClick={() => router.push('/meetings')} className="p-2 hover:bg-sky-600 rounded-md text-white"><Calendar size={24} /></button>
        <button onClick={() => router.push('/field-service')} className="p-2 hover:bg-sky-600 rounded-md text-white"><Briefcase size={24} /></button>
        <button onClick={() => router.push('/tasks')} className="p-2 hover:bg-sky-600 rounded-md text-white"><ClipboardList size={24} /></button>
        <button onClick={() => router.push('/events')} className="p-2 hover:bg-sky-600 rounded-md text-white"><CalendarDays size={24} /></button>
        <button className="p-2 bg-sky-600 shadow-inner rounded-md text-white"><Briefcase size={24} /></button>
        <div className="flex-1" />
        <button onClick={() => setMode(isDark ? 'light' : 'dark')} className="p-2 hover:bg-sky-600 rounded-md text-white">{isDark ? <Sun size={20} /> : <Moon size={20} />}</button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-700 to-cyan-900 text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Visita del Sup. de Circuito</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => navWeek(-1)} className="p-1 hover:bg-white/10 rounded"><ChevronLeft size={20} /></button>
            <span className="font-bold text-sm">{weekLabel(weekDate)}</span>
            <button onClick={() => navWeek(1)} className="p-1 hover:bg-white/10 rounded"><ChevronRight size={20} /></button>
            {dirty && visit?.id && (
              <button onClick={() => persist(visit)} className="bg-white text-cyan-700 px-3 py-1 rounded text-xs font-bold hover:bg-cyan-50 flex items-center gap-1"><Save size={12} /> Guardar</button>
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: anfitrión, companions, activity composer */}
          <div className={`w-[300px] border-r ${bgCard} p-3 overflow-y-auto shrink-0`}>
            <label className="block text-xs font-medium mb-1">Anfitrión</label>
            <select className={inputCls} value={visit?.host_id || ''} onChange={e => setField('host_id', e.target.value || null)}>
              <option value=""></option>
              {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>

            <h3 className="font-bold text-sm mt-4 mb-2">Nueva actividad</h3>
            <div className="grid grid-cols-2 gap-2">
              <select className={inputCls} value={draft.day} onChange={e => setDraft({ ...draft, day: e.target.value })}>
                {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
              </select>
              <select className={inputCls} value={draft.slot} onChange={e => setDraft({ ...draft, slot: e.target.value })}>
                {SLOTS.map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
              </select>
            </div>
            <input className={`${inputCls} mt-2`} placeholder="Actividad (p.ej. Servicio del campo)" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input type="time" className={inputCls} value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} />
              <input className={inputCls} placeholder="Lugar" value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} />
            </div>
            <textarea className={`${inputCls} mt-2`} rows={2} placeholder="Notas" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
            <button onClick={addActivity} className="w-full mt-2 bg-cyan-700 text-white text-xs py-1.5 rounded font-medium hover:bg-cyan-800 flex items-center justify-center gap-1"><Plus size={14} /> Agregar actividad</button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto p-2">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={`border p-1 w-20 ${bgCard}`}></th>
                  {DAYS.map(d => <th key={d} className={`border p-2 text-center font-bold capitalize ${bgCard}`}>{DAY_LABELS[d]}</th>)}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map(slot => (
                  <tr key={slot} style={{ height: 90 }}>
                    <td className={`border p-2 text-center font-bold ${bgCard}`}>{SLOT_LABELS[slot]}</td>
                    {DAYS.map(day => (
                      <td key={day} className={`border p-1 align-top ${bgCell}`} style={{ verticalAlign: 'top' }}>
                        {actFor(day, slot).map((a: any) => (
                          <div key={a.id} className={`mb-1 p-1 rounded text-xs border ${isDark ? 'border-cyan-700 bg-cyan-900/20' : 'border-cyan-200 bg-cyan-50'}`}>
                            <div className="flex justify-between items-start">
                              <span className="font-bold">{a.time}</span>
                              <button onClick={() => removeActivity(a.id)} className="text-red-400 hover:text-red-600"><X size={10} /></button>
                            </div>
                            <div>{a.title}</div>
                            {a.location && <div className="text-gray-500">{a.location}</div>}
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!visit && <p className="text-center text-red-600 font-bold mt-6">No hay ninguna visita programada.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
