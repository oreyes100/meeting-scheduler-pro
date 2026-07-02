'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Users, Calendar, BookOpen, Briefcase, ClipboardList, Sparkles, Wrench, CalendarDays, Mic,
  Sun, Moon, Plus, Trash2, Save, ChevronUp, ChevronDown
} from 'lucide-react';
import { Printer } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';
import { printTableReport } from '@/lib/printReport';

const DEFAULT_ROLES = [
  { name: 'Orador', positions: 1 },
  { name: 'Presidente', positions: 1 },
  { name: 'Oración inicial', positions: 1 },
  { name: 'Oración por el pan', positions: 1 },
  { name: 'Oración por el vino', positions: 1 },
  { name: 'Acomodadores (Izq.)', positions: 4 },
  { name: 'Acomodadores (Der.)', positions: 4 },
  { name: 'Acomodadores', positions: 4 },
  { name: 'Estacionamiento', positions: 4 },
  { name: 'Audio/Vídeo', positions: 2 },
  { name: 'Plataforma', positions: 1 },
  { name: 'Zoom Host', positions: 1 },
  { name: 'Preparar pan', positions: 1 },
  { name: 'Preparar vino', positions: 1 },
  { name: 'Preparar flores', positions: 1 },
  { name: 'Conteo', positions: 1 },
];

export default function MemorialPage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [roles, setRoles] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  const fetchData = useCallback(async () => {
    const [rRes, pRes] = await Promise.all([fetch('/api/memorial-roles'), fetch('/api/users')]);
    const rData = await rRes.json();
    const pData = await pRes.json();
    setPublishers(pData.users || []);
    setRoles(rData.rows || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const seedDefaults = async () => {
    for (let i = 0; i < DEFAULT_ROLES.length; i++) {
      await fetch('/api/memorial-roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...DEFAULT_ROLES[i], sort_order: i, assigned_to: [] }),
      });
    }
    fetchData();
  };

  const addRole = async () => {
    const res = await fetch('/api/memorial-roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nueva asignación', positions: 1, sort_order: roles.length, assigned_to: [] }),
    });
    if (res.ok) fetchData();
  };

  const saveRole = async (r: any) => {
    await fetch(`/api/memorial-roles/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
    setRoles(prev => prev.map(x => x.id === r.id ? r : x));
  };

  const deleteRole = async (id: string) => {
    await fetch(`/api/memorial-roles/${id}`, { method: 'DELETE' });
    setRoles(prev => prev.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `w-full border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;
  const assignedArr = (r: any): string[] => Array.isArray(r?.assigned_to) ? r.assigned_to : [];
  const printReport = () => {
    const rows = roles.map(r => [
      r.name,
      assignedArr(r).filter(Boolean).map(id => {
        const u = publishers.find(p => p.id === id);
        return u ? `${u.first_name} ${u.last_name}` : '';
      }).filter(Boolean).join(', '),
    ]);
    printTableReport({ title: 'Conmemoración', congName: 'Congregación', columns: ['Asignación', 'Personas'], rows });
  };

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />
      <SyncStatus />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        <div className="bg-gradient-to-r from-red-700 to-red-900 text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Conmemoración</h1>
          <div className="flex items-center gap-2">
            <button onClick={addRole} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium flex items-center gap-1"><Plus size={14} /> Asignación</button>
            <button onClick={printReport} className="p-1.5 hover:bg-white/10 rounded" title="Imprimir"><Printer size={18} /></button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Roles list */}
          <div className={`w-full md:w-[280px] max-h-[45vh] md:max-h-none border-r ${bgCard} flex flex-col shrink-0`}>
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 font-bold text-sm">Asignaciones</div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={isDark ? 'bg-gray-700' : 'bg-gray-100'}>
                    <th className="p-2 text-left text-xs">Nombre</th>
                    <th className="p-2 text-right text-xs w-16">Posiciones</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map(r => (
                    <tr key={r.id} onClick={() => setSelected({ ...r })}
                        className={`cursor-pointer border-b border-gray-100 dark:border-gray-700 ${selected?.id === r.id ? (isDark ? 'bg-red-900/30' : 'bg-red-50') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}>
                      <td className="p-2 text-xs">{r.name}</td>
                      <td className="p-2 text-xs text-right">{r.positions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roles.length === 0 && (
                <div className="p-4 text-center">
                  <button onClick={seedDefaults} className="text-red-600 underline text-xs font-medium">Cargar asignaciones predeterminadas</button>
                </div>
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <div className="max-w-2xl">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Nombre</label>
                    <input className={inputCls} value={selected.name || ''} onChange={e => setSelected({ ...selected, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Posiciones</label>
                    <input type="number" min={1} max={12} className={inputCls} value={selected.positions || 1}
                           onChange={e => setSelected({ ...selected, positions: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>

                <label className="block text-xs font-medium mb-2">Asignar personas</label>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: selected.positions || 1 }).map((_, i) => (
                    <select key={i} className={inputCls} value={assignedArr(selected)[i] || ''}
                            onChange={e => {
                              const arr = [...assignedArr(selected)];
                              while (arr.length <= i) arr.push('');
                              arr[i] = e.target.value;
                              setSelected({ ...selected, assigned_to: arr });
                            }}>
                      <option value=""></option>
                      {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                    </select>
                  ))}
                </div>

                <div className="flex gap-2 mt-6">
                  <button onClick={() => saveRole(selected)} className="bg-red-700 text-white text-sm py-1.5 px-4 rounded font-medium hover:bg-red-800 flex items-center gap-1"><Save size={14} /> Guardar</button>
                  <button onClick={() => deleteRole(selected.id)} className="bg-red-100 text-red-700 text-sm py-1.5 px-4 rounded hover:bg-red-200 flex items-center gap-1"><Trash2 size={14} /> Eliminar</button>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-center mt-12">Selecciona una asignación de la Conmemoración</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
