'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Users, Calendar, MapPin, BookOpen, Briefcase, Eye, Mic,
  Sun, Moon, ChevronLeft, ChevronRight, Save, ClipboardList, Sparkles, Printer
} from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { TasksPrintModal } from '@/components/TasksPrintModal';

const DEFAULT_TASKS = [
  { key: 'acomodadores', label: 'Acomodadores', slots: 2 },
  { key: 'seguridad', label: 'Seguridad', slots: 2 },
  { key: 'zoom_host', label: 'Zoom Host', slots: 2 },
  { key: 'microfonos', label: 'Micrófonos', slots: 3 },
  { key: 'audio_video', label: 'Audio/Vídeo', slots: 2 },
  { key: 'plataforma', label: 'Plataforma', slots: 2 },
  { key: 'personalizado_1', label: 'Personalizado 1', slots: 2 },
  { key: 'personalizado_2', label: 'Personalizado 2', slots: 2 },
  { key: 'personalizado_3', label: 'Personalizado 3', slots: 2 },
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

function personName(p: any): string {
  if (!p) return '';
  return p.display_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
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

export default function TasksPage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [allTasks, setAllTasks] = useState<Record<string, any>>({});
  const [publishers, setPublishers] = useState<any[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(() => fmtISO(getMonday(new Date())));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [cong, setCong] = useState<any>(null);
  const weeks = buildWeeks();
  const todayISO = fmtISO(getMonday(new Date()));

  const fetchData = useCallback(async () => {
    try {
      const [tRes, pRes, cRes] = await Promise.all([
        fetch('/api/congregation-tasks'),
        fetch('/api/users'),
        fetch('/api/congregation'),
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      const cData = await cRes.json();
      setPublishers(pData.users || []);
      setCong(cData.congregation || cData.settings || null);
      // Index tasks by week_date
      const map: Record<string, any> = {};
      for (const t of tData.tasks || []) {
        map[t.week_date] = t.assignments || {};
      }
      setAllTasks(map);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    await fetch('/api/congregation-tasks', {
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

  // Top assignment panel — lookup user by ID
  const userById = (id: string) => publishers.find(p => p.id === id);

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-800 text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Tareas</h1>
          <div className="flex items-center gap-3">
            <button onClick={() => navWeek(-1)} className="p-1 hover:bg-white/10 rounded"><ChevronLeft size={20} /></button>
            <span className="font-bold text-sm">{weekLabel(selectedWeek)}</span>
            <button onClick={() => navWeek(1)} className="p-1 hover:bg-white/10 rounded"><ChevronRight size={20} /></button>
            {dirty && (
              <button onClick={saveWeek} disabled={saving}
                      className="bg-white text-orange-700 px-3 py-1 rounded text-xs font-bold hover:bg-orange-50 disabled:opacity-50 flex items-center gap-1">
                <Save size={12} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            )}
            <button onClick={() => setShowPrint(true)} className="p-1.5 hover:bg-white/10 rounded" title="Imprimir"><Printer size={18} /></button>
          </div>
        </div>

        {showPrint && (
          <TasksPrintModal
            tasks={DEFAULT_TASKS}
            assignmentsByWeek={allTasks}
            publishers={publishers}
            congName={cong?.name || 'Congregación'}
            congAddress={cong?.kingdom_hall_address}
            onClose={() => setShowPrint(false)}
          />
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Left panel: current week assignment editor */}
          <div className={`w-[420px] border-r ${bgCard} p-4 overflow-y-auto shrink-0`}>
            <h2 className="font-bold text-sm mb-3 text-orange-600">{weekLabel(selectedWeek)}</h2>

            <table className="w-full border-collapse mb-4">
              <tbody>
                {DEFAULT_TASKS.map(task => (
                  Array.from({ length: task.slots }).map((_, slot) => (
                    <tr key={`${task.key}-${slot}`}>
                      <td className={`${tdCls} font-medium w-28`}>{slot === 0 ? task.label : ''}</td>
                      <td className={tdCls}>
                        <select className={selectCls}
                                value={getValue(task.key, slot)}
                                onChange={e => setValue(task.key, slot, e.target.value)}>
                          <option value=""></option>
                          {publishers.map(p => (
                            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                          ))}
                        </select>
                      </td>
                      {slot < task.slots - 1 && (
                        <td className="text-center text-xs text-gray-400 px-1">&amp;</td>
                      )}
                      {slot === task.slots - 1 && <td />}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>

            {dirty && (
              <button onClick={saveWeek} disabled={saving}
                      className="w-full bg-orange-600 text-white text-xs py-1.5 rounded font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-1">
                <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Semana'}
              </button>
            )}
          </div>

          {/* Right panel: weekly grid overview */}
          <div className="flex-1 overflow-auto p-3">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={`${thCls} w-24`}>Fecha</th>
                  {DEFAULT_TASKS.map(t => (
                    <th key={t.key} className={thCls}>{t.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map(week => {
                  const asgn = allTasks[week] || {};
                  const isSelected = week === selectedWeek;
                  const isToday = week === todayISO;

                  const cellName = (key: string) => {
                    const val = asgn[key];
                    if (Array.isArray(val)) {
                      return val.filter(Boolean).map((id: string) => {
                        const u = userById(id);
                        return u ? `${u.first_name} ${u.last_name[0]}.` : '';
                      }).filter(Boolean).join(' & ');
                    }
                    if (typeof val === 'string' && val) {
                      const u = userById(val);
                      return u ? `${u.first_name} ${u.last_name[0]}.` : '';
                    }
                    return '';
                  };

                  return (
                    <tr key={week}
                        className={`cursor-pointer ${isSelected ? (isDark ? 'bg-orange-900/40 ring-1 ring-orange-500' : 'bg-orange-50') : isToday ? (isDark ? 'bg-yellow-900/30' : 'bg-yellow-50') : (isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50')}`}
                        onClick={() => { setSelectedWeek(week); setDirty(false); }}>
                      <td className={`${tdCls} font-mono font-medium`}>{weekLabel(week)}</td>
                      {DEFAULT_TASKS.map(t => (
                        <td key={t.key} className={tdCls}>{cellName(t.key)}</td>
                      ))}
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
