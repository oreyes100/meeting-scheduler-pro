'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Users, Calendar, MapPin, BookOpen, Briefcase, Eye, Mic, ClipboardList,
  Sun, Moon, ChevronLeft, ChevronRight, Save, Sparkles
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';
import { printTableReport } from '@/lib/printReport';
import { Printer } from 'lucide-react';

const INTERIOR_TASKS = [
  { key: 'limpieza_ligera', label: 'Limpieza ligera', slots: 2 },
  { key: 'limpieza_a_fondo', label: 'Limpieza a fondo', slots: 2 },
  { key: 'limpieza_mensual', label: 'Limpieza mensual', slots: 2 },
  { key: 'limpieza_mayor', label: 'Limpieza mayor', slots: 2 },
];

const EXTERIOR_TASKS = [
  { key: 'limpieza_exterior_jardin', label: 'Limpieza exterior y jardín', slots: 2 },
  { key: 'cesped', label: 'Césped', slots: 2 },
];

const WEEKS_BACK = 8;
const WEEKS_FORWARD = 20;

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekLabel(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00');
  const sun = new Date(d);
  sun.setDate(sun.getDate() + 6);
  const mo = d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
  const su = sun.toLocaleDateString('es-MX', { day: 'numeric' });
  return `${mo}-${su}`;
}

function buildWeeks(): string[] {
  const m = getMonday(new Date());
  m.setDate(m.getDate() - WEEKS_BACK * 7);
  const weeks: string[] = [];
  for (let i = 0; i < WEEKS_BACK + WEEKS_FORWARD; i++) {
    weeks.push(fmtISO(m));
    m.setDate(m.getDate() + 7);
  }
  return weeks;
}

type Tab = 'interior' | 'exterior';

export default function CleaningPage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [tab, setTab] = useState<Tab>('interior');
  const [allTasks, setAllTasks] = useState<Record<string, any>>({});
  const [publishers, setPublishers] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(() => fmtISO(getMonday(new Date())));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const weeks = buildWeeks();
  const todayISO = fmtISO(getMonday(new Date()));

  const [groupCount, setGroupCount] = useState(4);

  const fetchData = useCallback(async () => {
    try {
      const [tRes, pRes, cRes] = await Promise.all([
        fetch('/api/cleaning-assignments'),
        fetch('/api/users'),
        fetch('/api/congregation'),
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      const cData = await cRes.json();
      setPublishers(pData.users || []);
      const map: Record<string, any> = {};
      for (const t of tData.tasks || []) map[t.week_date] = t.assignments || {};
      setAllTasks(map);
      setGroupCount(cData.congregation?.field_service_group_count ?? 4);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeTasks = tab === 'interior' ? INTERIOR_TASKS : EXTERIOR_TASKS;
  const currentAssignments = allTasks[selectedWeek] || {};

  const getValue = (taskKey: string, slot: number): string => {
    const val = currentAssignments[taskKey];
    if (Array.isArray(val)) return val[slot] || '';
    if (slot === 0 && typeof val === 'string') return val;
    return '';
  };

  const setValue = (taskKey: string, slot: number, userId: string) => {
    const existing: string[] = Array.isArray(currentAssignments[taskKey])
      ? [...currentAssignments[taskKey]]
      : [currentAssignments[taskKey] || ''];
    while (existing.length <= slot) existing.push('');
    existing[slot] = userId;
    setAllTasks(prev => ({
      ...prev,
      [selectedWeek]: { ...currentAssignments, [taskKey]: existing },
    }));
    setDirty(true);
  };

  const saveWeek = async () => {
    setSaving(true);
    await fetch('/api/cleaning-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_date: selectedWeek, assignments: allTasks[selectedWeek] || {} }),
    });
    setSaving(false);
    setDirty(false);
  };

  const navWeek = (dir: number) => {
    const d = new Date(selectedWeek + 'T00:00:00');
    d.setDate(d.getDate() + dir * 7);
    setSelectedWeek(fmtISO(d));
    setDirty(false);
  };

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const thCls = `border p-2 text-xs font-bold ${isDark ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-700 border-gray-200'}`;
  const tdCls = `border px-2 py-1 text-xs ${isDark ? 'border-gray-700' : 'border-gray-200'}`;
  const selectCls = `w-full text-xs border rounded px-1 py-0.5 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;

  const userById = (id: string) => publishers.find(p => p.id === id);
  const printReport = () => {
    const cols = ['Fecha', ...activeTasks.map(t => t.label)];
    const rows = weeks.map(wk => {
      const asgn = allTasks[wk] || {};
      return [weekLabel(wk), ...activeTasks.map(t => {
        const val = asgn[t.key];
        const ids = Array.isArray(val) ? val : (val ? [val] : []);
        return ids.filter(Boolean).map((id: string) => idLabel(id)).join(' & ');
      })];
    });
    printTableReport({ title: `Limpieza — ${tab === 'interior' ? 'Interior' : 'Exterior y Jardín'}`, congName: 'Congregación', columns: cols, rows });
  };
  const GROUPS = Array.from({ length: groupCount }, (_, i) => i + 1);
  const idLabel = (id: string, short = false): string => {
    if (id?.startsWith('group:')) return `Grupo ${id.slice(6)}`;
    const u = userById(id);
    if (!u) return '';
    return short ? `${u.first_name} ${u.last_name?.[0] || ''}.` : `${u.first_name} ${u.last_name}`;
  };

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />
      <SyncStatus pending={dirty} onSync={saveWeek} />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-800 text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Limpieza</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => { setTab('interior'); setDirty(false); }} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'interior' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Interior</button>
            <button onClick={() => { setTab('exterior'); setDirty(false); }} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'exterior' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Exterior y Jardín</button>
            <span className="w-px h-5 bg-white/30" />
            <button onClick={() => navWeek(-1)} className="p-1 hover:bg-white/10 rounded"><ChevronLeft size={20} /></button>
            <span className="font-bold text-sm">{weekLabel(selectedWeek)}</span>
            <button onClick={() => navWeek(1)} className="p-1 hover:bg-white/10 rounded"><ChevronRight size={20} /></button>
            {dirty && (
              <button onClick={saveWeek} disabled={saving}
                      className="bg-white text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-50 disabled:opacity-50 flex items-center gap-1">
                <Save size={12} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            )}
            <button onClick={printReport} className="p-1.5 hover:bg-white/10 rounded" title="Imprimir"><Printer size={18} /></button>
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left panel: week editor */}
          <div className={`w-full md:w-[420px] max-h-[45vh] md:max-h-none border-r ${bgCard} p-4 overflow-y-auto shrink-0`}>
            <h2 className="font-bold text-sm mb-3 text-green-600">{weekLabel(selectedWeek)}</h2>
            <table className="w-full border-collapse mb-4">
              <tbody>
                {activeTasks.map(task => (
                  Array.from({ length: task.slots }).map((_, slot) => (
                    <tr key={`${task.key}-${slot}`}>
                      <td className={`${tdCls} font-medium w-40`}>{slot === 0 ? task.label : ''}</td>
                      <td className={tdCls}>
                        <select className={selectCls}
                                value={getValue(task.key, slot)}
                                onChange={e => setValue(task.key, slot, e.target.value)}>
                          <option value=""></option>
                          <optgroup label="Grupos">
                            {GROUPS.map(g => <option key={`group:${g}`} value={`group:${g}`}>Grupo {g}</option>)}
                          </optgroup>
                          <optgroup label="Publicadores">
                            {publishers.map(p => (
                              <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
            {dirty && (
              <button onClick={saveWeek} disabled={saving}
                      className="w-full bg-green-600 text-white text-xs py-1.5 rounded font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1">
                <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Semana'}
              </button>
            )}
          </div>

          {/* Right panel: grid overview */}
          <div className="flex-1 overflow-auto p-3">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={`${thCls} w-32`}>Fecha</th>
                  {activeTasks.map(t => <th key={t.key} className={thCls}>{t.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {weeks.map(week => {
                  const asgn = allTasks[week] || {};
                  const isSelected = week === selectedWeek;
                  const isToday = week === todayISO;
                  const cellName = (key: string) => {
                    const val = asgn[key];
                    const ids = Array.isArray(val) ? val : (typeof val === 'string' && val ? [val] : []);
                    return ids.filter(Boolean).map((id: string) => idLabel(id, true)).filter(Boolean).join(' & ');
                  };
                  return (
                    <tr key={week}
                        className={`cursor-pointer ${isSelected ? (isDark ? 'bg-green-900/40 ring-1 ring-green-500' : 'bg-green-50') : isToday ? (isDark ? 'bg-yellow-900/30' : 'bg-yellow-50') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}
                        onClick={() => { setSelectedWeek(week); setDirty(false); }}>
                      <td className={`${tdCls} font-medium`}>{weekLabel(week)}</td>
                      {activeTasks.map(t => <td key={t.key} className={tdCls}>{cellName(t.key)}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
