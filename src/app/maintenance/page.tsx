'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Users, Calendar, MapPin, BookOpen, Briefcase, Eye, Mic, ClipboardList, Sparkles,
  Sun, Moon, Plus, Trash2, Save, X, Wrench, Printer
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { printTableReport } from '@/lib/printReport';

function personName(p: any): string {
  if (!p) return '';
  return p.display_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

export default function MaintenancePage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [tasks, setTasks] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchData = useCallback(async () => {
    const [tRes, pRes] = await Promise.all([fetch('/api/maintenance-tasks'), fetch('/api/users')]);
    const tData = await tRes.json();
    const pData = await pRes.json();
    setTasks(tData.rows || []);
    setPublishers(pData.users || []);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categories = Array.from(new Set(tasks.map(t => t.category).filter(Boolean)));

  const addTask = async () => {
    const res = await fetch('/api/maintenance-tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nueva tarea', sort_order: tasks.length, assigned_to: [] }),
    });
    if (res.ok) { const j = await res.json(); setTasks(prev => [...prev, j.row]); setSelected(j.row); }
  };

  const saveTask = async (t: any) => {
    await fetch(`/api/maintenance-tasks/${t.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t),
    });
    setTasks(prev => prev.map(x => x.id === t.id ? t : x));
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/maintenance-tasks/${id}`, { method: 'DELETE' });
    setTasks(prev => prev.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `w-full border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;

  const filtered = categoryFilter ? tasks.filter(t => t.category === categoryFilter) : tasks;
  const assignedArr = (t: any): string[] => Array.isArray(t?.assigned_to) ? t.assigned_to : [];
  const printReport = () => {
    const rows = filtered.map(t => [
      t.title, t.category || '', t.done ? 'Sí' : 'No',
      assignedArr(t).filter(Boolean).map(id => personName(publishers.find(p => p.id === id))).join(', '),
    ]);
    printTableReport({ title: 'Mantenimiento', congName: 'Congregación', columns: ['Tarea', 'Categoría', 'Terminado', 'Asignado a'], rows });
  };

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-slate-600 to-slate-800 text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Mantenimiento</h1>
          <div className="flex items-center gap-2">
            <button onClick={addTask} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm font-medium flex items-center gap-1"><Plus size={14} /> Nueva</button>
            <button onClick={printReport} className="p-1.5 hover:bg-white/10 rounded" title="Imprimir"><Printer size={18} /></button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* List */}
          <div className={`w-[320px] border-r ${bgCard} flex flex-col shrink-0`}>
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <select className={inputCls} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="">Ninguna categoría</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.map(t => (
                <button key={t.id} onClick={() => setSelected({ ...t })}
                        className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-sm flex items-center gap-2 ${selected?.id === t.id ? (isDark ? 'bg-slate-800' : 'bg-slate-100') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}>
                  <span className={`w-2 h-2 rounded-full ${t.done ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="flex-1 truncate">{t.title}</span>
                  {t.category && <span className="text-xs text-gray-400">{t.category}</span>}
                </button>
              ))}
              {filtered.length === 0 && <p className="text-center text-xs text-gray-400 p-4">Sin tareas</p>}
            </div>
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <div className="max-w-3xl">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Tarea de mantenimiento</label>
                    <input className={inputCls} value={selected.title || ''} onChange={e => setSelected({ ...selected, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Categoría</label>
                    <input className={inputCls} list="cats" value={selected.category || ''} onChange={e => setSelected({ ...selected, category: e.target.value })} />
                    <datalist id="cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                </div>

                <label className="block text-xs font-medium mb-1">Enlace</label>
                <input className={inputCls} value={selected.link || ''} onChange={e => setSelected({ ...selected, link: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-3">Descripción</label>
                <textarea className={inputCls} rows={4} value={selected.description || ''} onChange={e => setSelected({ ...selected, description: e.target.value })} />

                <div className="flex items-center gap-6 mt-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Terminado</label>
                    <button onClick={() => setSelected({ ...selected, done: !selected.done })}
                            className={`px-4 py-1 rounded text-sm font-bold ${selected.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {selected.done ? 'Sí' : 'No'}
                    </button>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1">Asignado a</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map(i => (
                        <select key={i} className={`${inputCls} text-xs`} value={assignedArr(selected)[i] || ''}
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
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button onClick={() => saveTask(selected)} className="bg-slate-600 text-white text-sm py-1.5 px-4 rounded font-medium hover:bg-slate-700 flex items-center gap-1"><Save size={14} /> Guardar</button>
                  <button onClick={() => deleteTask(selected.id)} className="bg-red-100 text-red-700 text-sm py-1.5 px-4 rounded hover:bg-red-200 flex items-center gap-1"><Trash2 size={14} /> Eliminar</button>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-center mt-12">Selecciona o crea una tarea</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
