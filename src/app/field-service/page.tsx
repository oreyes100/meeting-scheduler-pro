'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Users, Calendar, MapPin, BookOpen, Printer, Sun, Moon, ChevronLeft, ChevronRight, Plus, Trash2, Save, UserPlus, X } from 'lucide-react';
import { useTheme } from '@/lib/theme';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
};
const DAY_LABELS_EN: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(monday.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekRangeLabel(mondayISO: string): string {
  const d = new Date(mondayISO + 'T00:00:00');
  const sun = new Date(d);
  sun.setDate(sun.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  const start = d.toLocaleDateString('es-MX', opts);
  const end = sun.toLocaleDateString('es-MX', { day: 'numeric' });
  return `${start} - ${end}`;
}

function personName(p: any): string {
  if (!p) return '';
  return p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

function roleLabel(m: any): string {
  const parts: string[] = [];
  if (m.role === 'group_overseer') parts.push('SO');
  if (m.role === 'group_assistant') parts.push('AS');
  const u = m.user;
  if (u?.is_elder) parts.push('A');
  else if (u?.is_ministerial_servant) parts.push('SM');
  if (u?.is_regular_pioneer) parts.push('PR');
  else if (u?.is_special_pioneer) parts.push('PE');
  else if (u?.is_unbaptized_publisher) parts.push('PNB');
  return parts.length ? `(${parts.join(', ')})` : '';
}

type Tab = 'schedule' | 'groups';

export default function FieldServicePage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [tab, setTab] = useState<Tab>('schedule');
  const [weekDate, setWeekDate] = useState(() => fmtISO(getMonday(new Date())));
  const [meetings, setMeetings] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);
  const [editGroup, setEditGroup] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, gRes, pRes] = await Promise.all([
        fetch(`/api/field-service-meetings?week=${weekDate}`),
        fetch('/api/field-service-groups'),
        fetch('/api/users'),
      ]);
      const mData = await mRes.json();
      const gData = await gRes.json();
      const pData = await pRes.json();
      setMeetings(mData.meetings || []);
      setGroups(gData.groups || []);
      setPublishers(pData.users || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [weekDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const navWeek = (dir: number) => {
    const d = new Date(weekDate + 'T00:00:00');
    d.setDate(d.getDate() + dir * 7);
    setWeekDate(fmtISO(d));
    setSelectedMeeting(null);
  };

  const addMeeting = async (dayOfWeek: string, timePeriod: string) => {
    const res = await fetch('/api/field-service-meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ week_date: weekDate, day_of_week: dayOfWeek, time_period: timePeriod, meeting_time: timePeriod === 'am' ? '09:30' : '13:30' }),
    });
    if (res.ok) {
      const j = await res.json();
      setMeetings(prev => [...prev, j.meeting]);
      setSelectedMeeting(j.meeting);
    }
  };

  const updateMeeting = async (m: any) => {
    await fetch(`/api/field-service-meetings/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m),
    });
    setMeetings(prev => prev.map(x => x.id === m.id ? m : x));
  };

  const deleteMeeting = async (id: string) => {
    await fetch(`/api/field-service-meetings/${id}`, { method: 'DELETE' });
    setMeetings(prev => prev.filter(x => x.id !== id));
    if (selectedMeeting?.id === id) setSelectedMeeting(null);
  };

  const addGroup = async () => {
    const res = await fetch('/api/field-service-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Grupo ${groups.length + 1}`, sort_order: groups.length }),
    });
    if (res.ok) fetchData();
  };

  const saveGroup = async (g: any) => {
    await fetch(`/api/field-service-groups/${g.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: g, members: g.members }),
    });
    fetchData();
  };

  const deleteGroup = async (id: string) => {
    await fetch(`/api/field-service-groups/${id}`, { method: 'DELETE' });
    setEditGroup(null);
    fetchData();
  };

  // Schedule grid helpers
  const meetingsByDayPeriod = (day: string, period: string) =>
    meetings.filter(m => m.day_of_week === day && m.time_period === period);

  const dayDate = (dayOfWeek: string): string => {
    const idx = DAYS.indexOf(dayOfWeek);
    const d = new Date(weekDate + 'T00:00:00');
    d.setDate(d.getDate() + idx);
    return d.toLocaleDateString('es-MX', { day: 'numeric' });
  };

  const isDark = mode === 'dark';
  const bgMain = isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const bgCell = isDark ? 'bg-gray-800' : 'bg-white';
  const bgSat = isDark ? 'bg-yellow-900/30' : 'bg-yellow-50';
  const inputCls = `w-full border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;

  return (
    <div className={`flex h-screen ${bgMain} font-sans`}>
      {/* Icon sidebar */}
      <div className={`w-[52px] ${isDark ? 'bg-gray-900' : 'bg-sky-500'} flex flex-col items-center py-3 gap-3 shrink-0`}>
        <button onClick={() => router.push('/congregation')} className="p-2 hover:bg-sky-600 rounded-md text-white"><Home size={24} /></button>
        <button onClick={() => router.push('/persons')} className="p-2 hover:bg-sky-600 rounded-md text-white"><Users size={24} /></button>
        <button onClick={() => router.push('/meetings')} className="p-2 hover:bg-sky-600 rounded-md text-white"><Calendar size={24} /></button>
        <button onClick={() => router.push('/weekend')} className="p-2 hover:bg-sky-600 rounded-md text-white"><BookOpen size={24} /></button>
        <button onClick={() => router.push('/territories')} className="p-2 hover:bg-sky-600 rounded-md text-white"><MapPin size={24} /></button>
        <button className="p-2 bg-sky-600 shadow-inner rounded-md text-white"><Printer size={24} /></button>
        <div className="flex-1" />
        <button onClick={() => setMode(isDark ? 'light' : 'dark')} className="p-2 hover:bg-sky-600 rounded-md text-white">
          {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4BA3E3] to-[#31708f] text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Programa de Servicio del Campo</h1>
          <div className="flex gap-2">
            <button onClick={() => setTab('schedule')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'schedule' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Programa Semanal</button>
            <button onClick={() => setTab('groups')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'groups' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Grupos</button>
          </div>
        </div>

        {tab === 'schedule' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Weekly calendar */}
            <div className="flex-1 flex flex-col overflow-auto p-3">
              {/* Week nav */}
              <div className="flex items-center justify-center gap-4 mb-3">
                <button onClick={() => navWeek(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ChevronLeft size={24} className="text-blue-600" /></button>
                <h2 className="text-lg font-bold text-red-600">{weekRangeLabel(weekDate)}</h2>
                <button onClick={() => navWeek(1)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ChevronRight size={24} className="text-blue-600" /></button>
              </div>

              {/* Grid */}
              <div className="border border-gray-300 dark:border-gray-600 flex-1 overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={`border p-1 w-12 ${bgCard}`}></th>
                      {DAYS.map(day => (
                        <th key={day} className={`border p-2 text-center font-bold ${day === 'saturday' || day === 'sunday' ? bgSat : bgCard}`}>
                          {DAY_LABELS[day]}<br />
                          <span className="text-xs font-normal text-gray-500">{dayDate(day)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['am', 'pm'].map(period => (
                      <tr key={period}>
                        <td className={`border p-2 text-center font-bold text-xs ${bgCard}`}>{period.toUpperCase()}</td>
                        {DAYS.map(day => {
                          const cell = meetingsByDayPeriod(day, period);
                          const isSat = day === 'saturday' || day === 'sunday';
                          return (
                            <td key={day} className={`border p-1 align-top min-h-[100px] ${isSat ? bgSat : bgCell} cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700`}
                                onClick={() => { if (cell.length === 0) addMeeting(day, period); }}
                                style={{ minHeight: 120, verticalAlign: 'top' }}>
                              {cell.map(m => (
                                <div key={m.id}
                                     className={`mb-1 p-1 rounded text-xs cursor-pointer border ${selectedMeeting?.id === m.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-transparent hover:border-gray-300'}`}
                                     onClick={e => { e.stopPropagation(); setSelectedMeeting(m); }}>
                                  <div className="font-bold">{m.meeting_time || ''}</div>
                                  {m.location && <div className="text-gray-600 dark:text-gray-400">{m.location}</div>}
                                  {m.conductor && <div>{personName(m.conductor)}</div>}
                                  {m.cart_count > 0 && <div className="text-gray-500">{m.cart_count} × Carrito</div>}
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Saturday group arrangements */}
              {groups.length > 0 && (
                <div className="mt-3">
                  <h3 className="font-bold text-sm mb-1">Arreglos de Grupo — Sábado</h3>
                  <div className="flex gap-2 flex-wrap">
                    {groups.map(g => (
                      <div key={g.id} className={`border rounded p-2 text-xs ${bgCard} min-w-[140px]`}>
                        <div className="font-bold">{g.name}</div>
                        <div>{g.meeting_time || '—'}</div>
                        <div className="text-gray-500">{g.meeting_location || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Meeting detail panel */}
            {selectedMeeting && (
              <div className={`w-[300px] border-l ${bgCard} p-4 overflow-y-auto shrink-0`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm">{DAY_LABELS[selectedMeeting.day_of_week]} {selectedMeeting.time_period?.toUpperCase()}</h3>
                  <button onClick={() => setSelectedMeeting(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>

                <label className="block text-xs font-medium mb-1">Hora</label>
                <input type="time" className={inputCls} value={selectedMeeting.meeting_time || ''} onChange={e => setSelectedMeeting({ ...selectedMeeting, meeting_time: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Ubicación</label>
                <input className={inputCls} value={selectedMeeting.location || ''} onChange={e => setSelectedMeeting({ ...selectedMeeting, location: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Conductor</label>
                <select className={inputCls} value={selectedMeeting.conductor_id || ''} onChange={e => setSelectedMeeting({ ...selectedMeeting, conductor_id: e.target.value || null })}>
                  <option value=""></option>
                  {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>

                <label className="block text-xs font-medium mb-1 mt-2">Zoom Host</label>
                <select className={inputCls} value={selectedMeeting.zoom_host_id || ''} onChange={e => setSelectedMeeting({ ...selectedMeeting, zoom_host_id: e.target.value || null })}>
                  <option value=""></option>
                  {publishers.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>

                <label className="block text-xs font-medium mb-1 mt-2">Territorio</label>
                <input className={inputCls} value={selectedMeeting.territory || ''} onChange={e => setSelectedMeeting({ ...selectedMeeting, territory: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Carritos</label>
                <input type="number" className={inputCls} value={selectedMeeting.cart_count || 0} onChange={e => setSelectedMeeting({ ...selectedMeeting, cart_count: parseInt(e.target.value) || 0 })} />

                <label className="block text-xs font-medium mb-1 mt-2">Grupo</label>
                <select className={inputCls} value={selectedMeeting.group_id || ''} onChange={e => setSelectedMeeting({ ...selectedMeeting, group_id: e.target.value || null })}>
                  <option value="">— Sin grupo —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>

                <label className="block text-xs font-medium mb-1 mt-2">Notas</label>
                <textarea className={inputCls} rows={2} value={selectedMeeting.notes || ''} onChange={e => setSelectedMeeting({ ...selectedMeeting, notes: e.target.value })} />

                <div className="flex gap-2 mt-4">
                  <button onClick={() => updateMeeting(selectedMeeting)} className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded font-medium hover:bg-blue-700 flex items-center justify-center gap-1">
                    <Save size={14} /> Guardar
                  </button>
                  <button onClick={() => deleteMeeting(selectedMeeting.id)} className="bg-red-100 text-red-700 text-xs py-1.5 px-3 rounded hover:bg-red-200">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Groups tab */
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Grupos de Servicio del Campo</h2>
                <button onClick={addGroup} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
                  <Plus size={16} /> Nuevo Grupo
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups.map(g => (
                  <div key={g.id} className={`border rounded-lg ${bgCard} overflow-hidden`}>
                    <div className="bg-gradient-to-r from-gray-700 to-gray-600 text-white px-3 py-2 flex items-center justify-between">
                      <span className="font-bold">{g.name}</span>
                      <button onClick={() => setEditGroup(JSON.parse(JSON.stringify(g)))} className="text-white/70 hover:text-white text-xs">Editar</button>
                    </div>
                    <div className="p-3">
                      {/* GO/GA first, then members */}
                      {(g.members || [])
                        .sort((a: any, b: any) => {
                          const order: Record<string, number> = { group_overseer: 0, group_assistant: 1, member: 2 };
                          return (order[a.role] ?? 2) - (order[b.role] ?? 2);
                        })
                        .map((m: any) => (
                          <div key={m.id} className="text-sm py-0.5 flex gap-1">
                            {m.role === 'group_overseer' && <span className="font-bold text-blue-600">SO:</span>}
                            {m.role === 'group_assistant' && <span className="font-bold text-green-600">AS:</span>}
                            <span>{personName(m.user)}</span>
                            <span className="text-gray-400 text-xs">{roleLabel(m)}</span>
                          </div>
                        ))}
                      {(g.members || []).length === 0 && <p className="text-xs text-gray-400">Sin miembros</p>}
                      <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                        <div>Total: {g.members?.length || 0}</div>
                        {g.meeting_time && <div>{g.meeting_day ? DAY_LABELS[g.meeting_day] : 'Sábado'} {g.meeting_time} — {g.meeting_location || '—'}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit group panel */}
            {editGroup && (
              <div className={`w-[350px] border-l ${bgCard} p-4 overflow-y-auto shrink-0`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold">Editar Grupo</h3>
                  <button onClick={() => setEditGroup(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>

                <label className="block text-xs font-medium mb-1">Nombre</label>
                <input className={inputCls} value={editGroup.name || ''} onChange={e => setEditGroup({ ...editGroup, name: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Día de reunión</label>
                <select className={inputCls} value={editGroup.meeting_day || 'saturday'} onChange={e => setEditGroup({ ...editGroup, meeting_day: e.target.value })}>
                  {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                </select>

                <label className="block text-xs font-medium mb-1 mt-2">Hora</label>
                <input type="time" className={inputCls} value={editGroup.meeting_time || ''} onChange={e => setEditGroup({ ...editGroup, meeting_time: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-2">Ubicación</label>
                <input className={inputCls} value={editGroup.meeting_location || ''} onChange={e => setEditGroup({ ...editGroup, meeting_location: e.target.value })} />

                <div className="mt-3 mb-2 flex items-center justify-between">
                  <h4 className="font-bold text-sm">Miembros</h4>
                </div>

                {(editGroup.members || []).map((m: any, i: number) => (
                  <div key={m.user_id || i} className="flex items-center gap-1 mb-1">
                    <select className={`flex-1 text-xs border rounded px-1 py-0.5 ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
                            value={m.role || 'member'}
                            onChange={e => {
                              const ms = [...editGroup.members];
                              ms[i] = { ...ms[i], role: e.target.value };
                              setEditGroup({ ...editGroup, members: ms });
                            }}>
                      <option value="group_overseer">Superintendente</option>
                      <option value="group_assistant">Asistente</option>
                      <option value="member">Miembro</option>
                    </select>
                    <span className="text-xs truncate max-w-[120px]">{personName(m.user)}</span>
                    <button onClick={() => {
                      const ms = editGroup.members.filter((_: any, j: number) => j !== i);
                      setEditGroup({ ...editGroup, members: ms });
                    }} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                  </div>
                ))}

                <select className={`${inputCls} mt-1`} value="" onChange={e => {
                  if (!e.target.value) return;
                  const uid = e.target.value;
                  const existing = editGroup.members?.find((m: any) => m.user_id === uid);
                  if (existing) return;
                  const p = publishers.find((u: any) => u.id === uid);
                  setEditGroup({
                    ...editGroup,
                    members: [...(editGroup.members || []), { user_id: uid, role: 'member', user: p }],
                  });
                  e.target.value = '';
                }}>
                  <option value="">+ Agregar publicador...</option>
                  {publishers
                    .filter((p: any) => !(editGroup.members || []).some((m: any) => m.user_id === p.id))
                    .map((p: any) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>

                <div className="flex gap-2 mt-4">
                  <button onClick={() => { saveGroup(editGroup); setEditGroup(null); }} className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded font-medium hover:bg-blue-700 flex items-center justify-center gap-1">
                    <Save size={14} /> Guardar
                  </button>
                  <button onClick={() => deleteGroup(editGroup.id)} className="bg-red-100 text-red-700 text-xs py-1.5 px-3 rounded hover:bg-red-200">
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
