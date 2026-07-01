'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Users, Calendar, MapPin, BookOpen, Briefcase, Eye, ChevronLeft, ChevronRight, Plus, Trash2, Save, X, Sun, Moon, Printer } from 'lucide-react';
import { printTableReport } from '@/lib/printReport';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};
const DAY_SHORT: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié',
  thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom',
};

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

function weekRangeLabel(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00');
  const sun = new Date(d);
  sun.setDate(sun.getDate() + 6);
  const start = d.toLocaleDateString('es-MX', { month: 'long', day: 'numeric' });
  const end = sun.toLocaleDateString('es-MX', { day: 'numeric' });
  return `${start} - ${end}`;
}

function personName(p: any): string {
  if (!p) return '';
  return p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

type Tab = 'schedule' | 'locations';

interface PwShift {
  id?: string;
  location_id?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  persons_needed: number;
  sort_order?: number;
}

interface PwLocation {
  id: string;
  cart_number: number;
  name: string;
  address?: string;
  map_link?: string;
  notes?: string;
  sort_order: number;
  shifts: PwShift[];
}

export default function PublicWitnessingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { mode, setMode } = useTheme();
  const [tab, setTab] = useState<Tab>('schedule');
  const [weekDate, setWeekDate] = useState(() => fmtISO(getMonday(new Date())));
  const [locations, setLocations] = useState<PwLocation[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [editLoc, setEditLoc] = useState<PwLocation | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ shiftId: string; day: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, aRes, pRes] = await Promise.all([
        fetch('/api/pw-locations'),
        fetch(`/api/pw-assignments?week=${weekDate}`),
        fetch('/api/users'),
      ]);
      const lData = await lRes.json();
      const aData = await aRes.json();
      const pData = await pRes.json();
      setLocations(lData.locations || []);
      setAssignments(aData.assignments || []);
      setPublishers(pData.users || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [weekDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navWeek = (dir: number) => {
    const d = new Date(weekDate + 'T00:00:00');
    d.setDate(d.getDate() + dir * 7);
    setWeekDate(fmtISO(d));
    setSelectedCell(null);
  };

  const addAssignment = async (shiftId: string, userId: string) => {
    const res = await fetch('/api/pw-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId, week_date: weekDate, user_id: userId }),
    });
    if (res.ok) {
      const j = await res.json();
      setAssignments(prev => [...prev, j.assignment]);
    }
  };

  const removeAssignment = async (id: string) => {
    await fetch(`/api/pw-assignments?id=${id}`, { method: 'DELETE' });
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const addLocation = async () => {
    const num = locations.length + 1;
    const res = await fetch('/api/pw-locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cart_number: num, name: `Ubicación ${num}`, sort_order: locations.length }),
    });
    if (res.ok) fetchData();
  };

  const saveLocation = async (loc: PwLocation) => {
    await fetch(`/api/pw-locations/${loc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...loc }),
    });
    fetchData();
    setEditLoc(null);
  };

  const deleteLocation = async (id: string) => {
    await fetch(`/api/pw-locations/${id}`, { method: 'DELETE' });
    setEditLoc(null);
    fetchData();
  };

  // Helpers
  const getShiftsForDay = (day: string): { shift: PwShift; location: PwLocation }[] => {
    const result: { shift: PwShift; location: PwLocation }[] = [];
    for (const loc of locations) {
      for (const s of loc.shifts) {
        if (s.day_of_week === day) result.push({ shift: s, location: loc });
      }
    }
    return result;
  };

  const printReport = () => {
    const rows: string[][] = [];
    for (const day of DAYS) {
      for (const { shift, location } of getShiftsForDay(day)) {
        const names = assignmentsForShift(shift.id!).map((a: any) => personName(a.user)).filter(Boolean).join(', ');
        rows.push([DAY_LABELS[day] || day, `${location.name} (${location.cart_number})`, `${shift.start_time}-${shift.end_time}`, names]);
      }
    }
    printTableReport({ title: 'Predicación Pública con Carritos', congName: 'Congregación', subtitle: weekRangeLabel(weekDate), columns: ['Día', 'Ubicación', 'Turno', 'Publicadores'], rows });
  };

  const assignmentsForShift = (shiftId: string) =>
    assignments.filter(a => a.shift_id === shiftId);

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `w-full border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      {/* Icon sidebar */}
      <IconSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Predicación Pública con Carritos</h1>
          <div className="flex gap-2">
            <button onClick={() => setTab('schedule')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'schedule' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Programa Semanal</button>
            <button onClick={() => setTab('locations')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'locations' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Ubicaciones</button>
            <button onClick={printReport} className="p-1.5 hover:bg-white/10 rounded" title="Imprimir"><Printer size={18} /></button>
          </div>
        </div>

        {tab === 'schedule' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Weekly schedule grid */}
            <div className="flex-1 flex flex-col overflow-auto p-3">
              {/* Week nav */}
              <div className="flex items-center justify-center gap-4 mb-3">
                <button onClick={() => navWeek(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ChevronLeft size={24} className="text-purple-600" /></button>
                <h2 className="text-lg font-bold text-red-600">{weekRangeLabel(weekDate)}</h2>
                <button onClick={() => navWeek(1)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ChevronRight size={24} className="text-purple-600" /></button>
              </div>

              {/* Grid: days as columns, AM/PM rows */}
              <div className="border border-gray-300 dark:border-gray-600 flex-1 overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={`border p-1 w-12 ${bgCard}`}></th>
                      {DAYS.map(day => (
                        <th key={day} className={`border p-2 text-center font-bold ${bgCard}`}>
                          {DAY_LABELS[day]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['am', 'pm'].map(period => (
                      <tr key={period} style={{ height: 200 }}>
                        <td className={`border p-2 text-center font-bold text-xs ${bgCard}`}>{period.toUpperCase()}</td>
                        {DAYS.map(day => {
                          const shifts = getShiftsForDay(day);
                          const periodShifts = shifts.filter(({ shift }) => {
                            const hour = parseInt(shift.start_time.split(':')[0]);
                            return period === 'am' ? hour < 12 : hour >= 12;
                          });

                          return (
                            <td key={day} className={`border p-1 align-top ${isDark ? 'bg-gray-800' : 'bg-white'}`} style={{ verticalAlign: 'top' }}>
                              {periodShifts.map(({ shift, location }) => {
                                const assigned = assignmentsForShift(shift.id!);
                                const count = assigned.length;
                                const needed = shift.persons_needed;
                                const isFull = count >= needed;
                                const isSelected = selectedCell?.shiftId === shift.id && selectedCell?.day === day;

                                return (
                                  <div key={shift.id}
                                       className={`mb-1 p-1.5 rounded text-xs border cursor-pointer ${
                                         isSelected ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' :
                                         isFull ? 'border-green-300 bg-green-50 dark:bg-green-900/20' :
                                         'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                                       }`}
                                       onClick={() => setSelectedCell({ shiftId: shift.id!, day })}>
                                    <div className="font-bold">{location.name} ({location.cart_number})</div>
                                    <div>{shift.start_time}-{shift.end_time} <span className={`font-medium ${isFull ? 'text-green-600' : 'text-orange-500'}`}>({count}/{needed})</span></div>
                                    {assigned.map((a: any) => (
                                      <div key={a.id} className="flex items-center justify-between mt-0.5">
                                        <span>{personName(a.user)}</span>
                                        <button onClick={e => { e.stopPropagation(); removeAssignment(a.id); }} className="text-red-400 hover:text-red-600"><X size={10} /></button>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Assignment panel */}
            {selectedCell && (() => {
              const shift = locations.flatMap(l => l.shifts).find(s => s.id === selectedCell.shiftId);
              const loc = locations.find(l => l.shifts.some(s => s.id === selectedCell.shiftId));
              if (!shift || !loc) return null;
              const assigned = assignmentsForShift(shift.id!);
              const assignedIds = new Set(assigned.map((a: any) => a.user_id));

              return (
                <div className={`w-[300px] border-l ${bgCard} p-4 overflow-y-auto shrink-0`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">{DAY_LABELS[selectedCell.day]}</h3>
                    <button onClick={() => setSelectedCell(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                  </div>

                  <div className="mb-3">
                    <div className="font-bold">{loc.name} (Carrito {loc.cart_number})</div>
                    {loc.notes && <div className="text-xs text-gray-500 mt-1">{loc.notes}</div>}
                    <div className="text-sm mt-1">{shift.start_time} - {shift.end_time}</div>
                  </div>

                  <h4 className="font-bold text-xs mb-1">Publicadores ({assigned.length}/{shift.persons_needed})</h4>
                  {assigned.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-sm">{personName(a.user)}</span>
                      <button onClick={() => removeAssignment(a.id)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ))}

                  {assigned.length < shift.persons_needed && (
                    <select className={`${inputCls} mt-2`} value="" onChange={e => {
                      if (e.target.value) addAssignment(shift.id!, e.target.value);
                    }}>
                      <option value="">+ Agregar publicador...</option>
                      {publishers
                        .filter(p => !assignedIds.has(p.id))
                        .map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                    </select>
                  )}

                  {assigned.length >= shift.persons_needed && (
                    <div className="mt-2 text-xs text-green-600 font-medium">Turno Lleno</div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          /* Locations tab */
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Ubicaciones de Predicación Pública</h2>
                <button onClick={addLocation} className="bg-purple-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-purple-700 flex items-center gap-1">
                  <Plus size={16} /> Nueva Ubicación
                </button>
              </div>

              <table className={`w-full border-collapse text-sm ${bgCard} border rounded-lg overflow-hidden`}>
                <thead>
                  <tr className={isDark ? 'bg-gray-700' : 'bg-gray-100'}>
                    <th className="border p-2 text-left">Carrito</th>
                    <th className="border p-2 text-left">Ubicación</th>
                    <th className="border p-2 text-left">Turnos</th>
                    <th className="border p-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map(loc => (
                    <tr key={loc.id} className={`${editLoc?.id === loc.id ? (isDark ? 'bg-purple-900/20' : 'bg-yellow-50') : ''} hover:bg-gray-50 dark:hover:bg-gray-700`}>
                      <td className="border p-2 font-bold text-center">{loc.cart_number}</td>
                      <td className="border p-2">
                        <div className="font-medium">{loc.name}</div>
                        {loc.notes && <div className="text-xs text-gray-500">{loc.notes}</div>}
                      </td>
                      <td className="border p-2 text-xs">
                        {loc.shifts.map(s => `${DAY_SHORT[s.day_of_week]} ${s.start_time}-${s.end_time}`).join(', ') || '—'}
                      </td>
                      <td className="border p-2 text-center">
                        <button onClick={() => setEditLoc(JSON.parse(JSON.stringify(loc)))} className="text-purple-600 hover:text-purple-800 text-xs font-medium">Editar</button>
                      </td>
                    </tr>
                  ))}
                  {locations.length === 0 && (
                    <tr><td colSpan={4} className="border p-4 text-center text-gray-400">No hay ubicaciones configuradas</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Edit location panel */}
            {editLoc && (
              <div className={`w-[350px] border-l ${bgCard} p-4 overflow-y-auto shrink-0`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">Editar Ubicación</h3>
                  <button onClick={() => setEditLoc(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>

                <label className="block text-xs font-medium mb-1">Número de Carrito</label>
                <input type="number" className={inputCls} value={editLoc.cart_number} onChange={e => setEditLoc({ ...editLoc, cart_number: parseInt(e.target.value) || 1 })} />

                <label className="block text-xs font-medium mb-1 mt-2">Nombre</label>
                <input className={inputCls} value={editLoc.name} onChange={e => setEditLoc({ ...editLoc, name: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Dirección</label>
                <input className={inputCls} value={editLoc.address || ''} onChange={e => setEditLoc({ ...editLoc, address: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Enlace Mapa</label>
                <input className={inputCls} value={editLoc.map_link || ''} onChange={e => setEditLoc({ ...editLoc, map_link: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Notas</label>
                <textarea className={inputCls} rows={2} value={editLoc.notes || ''} onChange={e => setEditLoc({ ...editLoc, notes: e.target.value })} />

                <div className="mt-3 mb-2 flex items-center justify-between">
                  <h4 className="font-bold text-sm">Turnos</h4>
                  <button onClick={() => {
                    setEditLoc({
                      ...editLoc,
                      shifts: [...editLoc.shifts, { day_of_week: 'monday', start_time: '09:00', end_time: '10:00', persons_needed: 2 }],
                    });
                  }} className="text-purple-600 text-xs font-medium flex items-center gap-0.5"><Plus size={12} /> Turno</button>
                </div>

                {editLoc.shifts.map((s, i) => (
                  <div key={i} className={`border rounded p-2 mb-2 ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                    <div className="flex gap-1 items-center mb-1">
                      <select className={`flex-1 text-xs border rounded px-1 py-0.5 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                              value={s.day_of_week}
                              onChange={e => {
                                const ss = [...editLoc.shifts];
                                ss[i] = { ...ss[i], day_of_week: e.target.value };
                                setEditLoc({ ...editLoc, shifts: ss });
                              }}>
                        {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                      </select>
                      <button onClick={() => {
                        const ss = editLoc.shifts.filter((_, j) => j !== i);
                        setEditLoc({ ...editLoc, shifts: ss });
                      }} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                    </div>
                    <div className="flex gap-1 items-center text-xs">
                      <input type="time" className={`border rounded px-1 py-0.5 w-24 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                             value={s.start_time}
                             onChange={e => { const ss = [...editLoc.shifts]; ss[i] = { ...ss[i], start_time: e.target.value }; setEditLoc({ ...editLoc, shifts: ss }); }} />
                      <span>—</span>
                      <input type="time" className={`border rounded px-1 py-0.5 w-24 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                             value={s.end_time}
                             onChange={e => { const ss = [...editLoc.shifts]; ss[i] = { ...ss[i], end_time: e.target.value }; setEditLoc({ ...editLoc, shifts: ss }); }} />
                      <input type="number" className={`border rounded px-1 py-0.5 w-10 text-center ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                             value={s.persons_needed}
                             min={1} max={10}
                             onChange={e => { const ss = [...editLoc.shifts]; ss[i] = { ...ss[i], persons_needed: parseInt(e.target.value) || 2 }; setEditLoc({ ...editLoc, shifts: ss }); }} />
                      <span className="text-gray-400">pers.</span>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 mt-4">
                  <button onClick={() => saveLocation(editLoc)} className="flex-1 bg-purple-600 text-white text-xs py-1.5 rounded font-medium hover:bg-purple-700 flex items-center justify-center gap-1">
                    <Save size={14} /> Guardar
                  </button>
                  <button onClick={() => deleteLocation(editLoc.id)} className="bg-red-100 text-red-700 text-xs py-1.5 px-3 rounded hover:bg-red-200">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
