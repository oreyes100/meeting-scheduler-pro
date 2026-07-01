'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Users, Calendar, MapPin, BookOpen, Briefcase, Eye, Mic, ClipboardList, Sparkles, Wrench,
  Sun, Moon, Plus, Trash2, Save, CalendarDays, Printer
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { printTableReport } from '@/lib/printReport';

const EVENT_TYPES = [
  'Asamblea de circuito', 'Asamblea regional', 'Visita del superintendente de circuito',
  'Conmemoración', 'Semana especial', 'Reunión cancelada', 'Otro',
];

export default function EventsPage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [events, setEvents] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/events');
    const data = await res.json();
    setEvents(data.rows || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const newEvent = () => setSelected({ type: EVENT_TYPES[0], name: '', single_day: false });

  const printReport = () => {
    const rows = events.map(ev => [
      ev.type || '', ev.name || '',
      `${ev.start_date || ''}${ev.end_date && !ev.single_day ? ` → ${ev.end_date}` : ''}`,
      ev.group_name || '',
    ]);
    printTableReport({ title: 'Eventos de la Congregación', congName: 'Congregación', columns: ['Tipo', 'Nombre del evento', 'Fecha', 'Grupo'], rows });
  };

  const save = async () => {
    if (selected.id) {
      await fetch(`/api/events/${selected.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selected) });
    } else {
      const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selected) });
      if (res.ok) { const j = await res.json(); setSelected(j.row); }
    }
    fetchData();
  };

  const del = async (id: string) => {
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    setSelected(null);
    fetchData();
  };

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `w-full border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Eventos</h1>
          <div className="flex items-center gap-2">
            <button onClick={newEvent} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium flex items-center gap-1"><Plus size={14} /> Nuevo</button>
            <button onClick={printReport} className="p-1.5 hover:bg-white/10 rounded" title="Imprimir"><Printer size={18} /></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Form */}
          <div className={`w-[420px] border-r ${bgCard} p-4 overflow-y-auto shrink-0`}>
            {selected ? (
              <>
                <label className="block text-xs font-medium mb-1">Tipo</label>
                <select className={inputCls} value={selected.type || ''} onChange={e => setSelected({ ...selected, type: e.target.value })}>
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <label className="block text-xs font-medium mb-1 mt-3">Nombre del evento</label>
                <input className={inputCls} value={selected.name || ''} onChange={e => setSelected({ ...selected, name: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-3">Descripción</label>
                <textarea className={inputCls} rows={3} value={selected.description || ''} onChange={e => setSelected({ ...selected, description: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-3">Enlace</label>
                <input className={inputCls} value={selected.link || ''} onChange={e => setSelected({ ...selected, link: e.target.value })} />

                <label className="flex items-center gap-2 mt-3 text-sm">
                  <input type="checkbox" checked={!!selected.single_day} onChange={e => setSelected({ ...selected, single_day: e.target.checked })} />
                  Solo 1 día
                </label>

                <label className="block text-xs font-medium mb-1 mt-3">Fecha de inicio</label>
                <input type="date" className={inputCls} value={selected.start_date || ''} onChange={e => setSelected({ ...selected, start_date: e.target.value })} />

                {!selected.single_day && (
                  <>
                    <label className="block text-xs font-medium mb-1 mt-3">Fecha final</label>
                    <input type="date" className={inputCls} value={selected.end_date || ''} onChange={e => setSelected({ ...selected, end_date: e.target.value })} />
                  </>
                )}

                <label className="block text-xs font-medium mb-1 mt-3">Grupo</label>
                <input className={inputCls} value={selected.group_name || ''} onChange={e => setSelected({ ...selected, group_name: e.target.value })} placeholder="Toda la congregación" />

                <div className="flex gap-2 mt-5">
                  <button onClick={save} className="flex-1 bg-indigo-600 text-white text-sm py-1.5 rounded font-medium hover:bg-indigo-700 flex items-center justify-center gap-1"><Save size={14} /> Guardar</button>
                  {selected.id && <button onClick={() => del(selected.id)} className="bg-red-100 text-red-700 text-sm py-1.5 px-3 rounded hover:bg-red-200"><Trash2 size={14} /></button>}
                </div>
              </>
            ) : <p className="text-gray-400 text-center mt-12 text-sm">Selecciona o crea un evento</p>}
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto p-3">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`border p-2 text-left text-xs font-bold ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>Tipo</th>
                  <th className={`border p-2 text-left text-xs font-bold ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>Nombre del evento</th>
                  <th className={`border p-2 text-left text-xs font-bold ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>Fecha</th>
                  <th className={`border p-2 text-left text-xs font-bold ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'}`}>Grupo</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} onClick={() => setSelected({ ...ev })}
                      className={`cursor-pointer ${selected?.id === ev.id ? (isDark ? 'bg-indigo-900/30' : 'bg-indigo-50') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}>
                    <td className={`border p-2 text-xs ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{ev.type}</td>
                    <td className={`border p-2 text-xs ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{ev.name}</td>
                    <td className={`border p-2 text-xs font-mono ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{ev.start_date}{ev.end_date && !ev.single_day ? ` → ${ev.end_date}` : ''}</td>
                    <td className={`border p-2 text-xs ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>{ev.group_name || '—'}</td>
                  </tr>
                ))}
                {events.length === 0 && <tr><td colSpan={4} className={`border p-6 text-center text-gray-400 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>Sin eventos</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
