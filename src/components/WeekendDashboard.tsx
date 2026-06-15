'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Settings, ChevronDown, ChevronRight, Save, X, Zap, Clock, RotateCcw, Printer } from 'lucide-react';
import { PublicSpeakerModal } from './PublicSpeakerModal';
import { WeekendPrintModal } from './WeekendPrintModal';
import type { WeekendMeeting, PublicTalkOutline, PublicSpeaker, CongregationSettings } from '@/types';
import { formatWeekRange } from '@/lib/weekLabel';

interface LocalPerson {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  can_be_speaker?: boolean;
  can_give_public_talk?: boolean;
  can_be_chairman?: boolean;
  can_be_cbs_conductor?: boolean;
  can_be_cbs_reader?: boolean;
}

// Hospitality assignments: groups first, then individual publishers.
const HOSPITALITY_GROUPS = ['Grupo 1', 'Grupo 2', 'Grupo 3', 'Grupo 4', 'Grupo 5'];

interface HistoryRecord {
  id: string;
  date: string;
  speaker_name: string | null;
  outline: { number: number; title: string } | null;
}

interface Props {
  meetings: WeekendMeeting[];
  outlines: PublicTalkOutline[];
  visitingSpeakers: PublicSpeaker[];
  localPersons: LocalPerson[];
  locale: 'en' | 'es';
  onRefresh: () => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  congregation?: CongregationSettings | null;
}

function personName(p: { first_name?: string | null; last_name?: string | null; display_name?: string | null } | null | undefined) {
  if (!p) return '';
  return p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ');
}

function outlineLabel(m: WeekendMeeting) {
  if (m.special_talk_title) return m.special_talk_title;
  if (m.outline) return `${m.outline.number} - ${m.outline.title}`;
  return '';
}

function speakerLabel(m: WeekendMeeting) {
  if (m.speaker_type === 'other') return m.other_speaker_name || '';
  if (m.speaker_type === 'visiting') return m.visiting_speaker?.name || '';
  if (m.speaker_type === 'local') return personName(m.local_speaker);
  return '';
}

function congregationLabel(m: WeekendMeeting) {
  if (m.speaker_type === 'visiting') return m.visiting_speaker?.congregation || '';
  if (m.speaker_type === 'local') return 'Local';
  return '';
}

// Returns person ID assigned least recently for a role across all meetings
function pickByRotation(
  pool: LocalPerson[],
  meetings: WeekendMeeting[],
  field: 'chairman_id' | 'wt_conductor_id' | 'wt_reader_id' | 'hospitality_person_id',
  excludeId?: string | null,
): string | null {
  if (pool.length === 0) return null;
  // Build map: personId -> last assignment date
  const lastAssigned: Record<string, string> = {};
  for (const m of meetings) {
    const val = m[field];
    if (val) lastAssigned[val] = m.date > (lastAssigned[val] ?? '') ? m.date : lastAssigned[val];
  }
  const candidates = excludeId ? pool.filter(p => p.id !== excludeId) : pool;
  if (candidates.length === 0) return pool[0].id;
  candidates.sort((a, b) => {
    const da = lastAssigned[a.id] ?? '0000-00-00';
    const db = lastAssigned[b.id] ?? '0000-00-00';
    return da < db ? -1 : da > db ? 1 : 0;
  });
  return candidates[0].id;
}

export function WeekendDashboard({ meetings, outlines, visitingSpeakers, localPersons, locale, onRefresh, activeId, setActiveId, congregation }: Props) {
  const [speakerModalOpen, setSpeakerModalOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [formData, setFormData] = useState<Record<string, Partial<WeekendMeeting>>>({});
  const [showOutlineManager, setShowOutlineManager] = useState(false);
  const [showSpeakerManager, setShowSpeakerManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const activeMeeting = meetings.find(m => m.id === activeId);

  const setField = useCallback((field: string, value: unknown) => {
    if (!activeId) return;
    setFormData(prev => ({
      ...prev,
      [activeId]: { ...(prev[activeId] ?? {}), [field]: value },
    }));
  }, [activeId]);

  const save = useCallback(async () => {
    if (!activeId || !formData[activeId]) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/weekend-meetings/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData[activeId]),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setFormData(prev => { const n = { ...prev }; delete n[activeId]; return n; });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [activeId, formData, onRefresh]);

  const autoAssign = useCallback(async () => {
    if (!activeId || !activeMeeting) return;
    setAutoAssigning(true);
    try {
      const chairPool = localPersons.filter(p => p.can_be_chairman);
      const wtPool = localPersons.filter(p => p.can_be_cbs_conductor || p.can_be_chairman);
      const readerPool = localPersons.filter(p => p.can_be_cbs_reader);
      const hospPool = localPersons;

      const otherMeetings = meetings.filter(m => m.id !== activeId);

      const chairmanId = pickByRotation(chairPool, otherMeetings, 'chairman_id');
      const wtId = pickByRotation(wtPool, otherMeetings, 'wt_conductor_id', chairmanId);
      const readerId = pickByRotation(readerPool, otherMeetings, 'wt_reader_id', wtId);
      const hospId = pickByRotation(hospPool, otherMeetings, 'hospitality_person_id', chairmanId);

      const patch: Partial<WeekendMeeting> = {
        chairman_id: chairmanId,
        wt_conductor_id: wtId,
        wt_reader_id: readerId,
        hospitality_person_id: hospId,
      };

      const res = await fetch(`/api/weekend-meetings/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setFormData(prev => { const n = { ...prev }; delete n[activeId]; return n; });
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error en auto-asignación');
    } finally {
      setAutoAssigning(false);
    }
  }, [activeId, activeMeeting, localPersons, meetings, onRefresh]);

  const removeAssignments = useCallback(async () => {
    if (!activeId) return;
    if (!confirm('¿Quitar todas las asignaciones de esta semana?')) return;
    const res = await fetch(`/api/weekend-meetings/${activeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chairman_id: null,
        wt_conductor_id: null,
        wt_reader_id: null,
        hospitality_person_id: null,
        hospitality_text: null,
      }),
    });
    if (res.ok) {
      setFormData(prev => { const n = { ...prev }; delete n[activeId]; return n; });
      onRefresh();
    }
  }, [activeId, onRefresh]);

  const deleteMeeting = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar esta reunión de fin de semana?')) return;
    await fetch(`/api/weekend-meetings/${id}`, { method: 'DELETE' });
    if (activeId === id) setActiveId(null);
    onRefresh();
  }, [activeId, onRefresh]);

  const handleSpeakerConfirm = useCallback((result: {
    speakerType: 'local' | 'visiting' | 'other';
    localSpeakerId?: string;
    visitingSpeakerId?: string;
    otherSpeakerName?: string;
    outlineId?: string;
    specialTalkTitle?: string;
  }) => {
    if (!activeId) return;
    const patch: Partial<WeekendMeeting> = {
      speaker_type: result.speakerType,
      local_speaker_id: result.localSpeakerId ?? null,
      visiting_speaker_id: result.visitingSpeakerId ?? null,
      other_speaker_name: result.otherSpeakerName ?? null,
      outline_id: result.outlineId ?? null,
      special_talk_title: result.specialTalkTitle ?? null,
    };
    setFormData(prev => ({
      ...prev,
      [activeId]: { ...(prev[activeId] ?? {}), ...patch },
    }));
    setSpeakerModalOpen(false);
  }, [activeId]);

  const isDirty = activeId ? !!formData[activeId] : false;

  const chairmenPool = localPersons.filter(p => p.can_be_chairman);
  const wtPool = localPersons.filter(p => p.can_be_cbs_conductor || p.can_be_chairman);
  const readerPool = localPersons.filter(p => p.can_be_cbs_reader);
  // Local public speakers: the populated capability flag is `can_be_speaker`
  // (legacy `can_give_public_talk` kept as fallback).
  const localSpeakerPool = localPersons.filter(p => p.can_be_speaker || p.can_give_public_talk);

  const getField = (field: string) => {
    if (!activeId) return '';
    const local = formData[activeId];
    if (local && field in local) return (local as unknown as Record<string, unknown>)[field] ?? '';
    return (activeMeeting as unknown as Record<string, unknown>)?.[field] ?? '';
  };

  const mergedMeeting = activeMeeting
    ? { ...activeMeeting, ...(formData[activeId!] ?? {}) } as WeekendMeeting
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Top toolbar: managers */}
      <div className="px-4 py-2 border-b border-gray-200 bg-white flex gap-2 items-center">
        <button
          onClick={() => setShowOutlineManager(v => !v)}
          className="text-xs border border-gray-300 rounded px-3 py-1.5 bg-white hover:bg-gray-100 flex items-center gap-1"
        >
          <Settings size={12} /> Discursos
        </button>
        <button
          onClick={() => setShowSpeakerManager(v => !v)}
          className="text-xs border border-gray-300 rounded px-3 py-1.5 bg-white hover:bg-gray-100 flex items-center gap-1"
        >
          <Settings size={12} /> Oradores
        </button>
        <button
          onClick={() => setShowHistory(true)}
          className="text-xs border border-gray-300 rounded px-3 py-1.5 bg-white hover:bg-gray-100 flex items-center gap-1"
        >
          <Clock size={12} /> Historial
        </button>
        <button
          onClick={() => setPrintOpen(true)}
          className="text-xs border border-gray-300 rounded px-3 py-1.5 bg-white hover:bg-gray-100 flex items-center gap-1"
        >
          <Printer size={12} /> Imprimir mes
        </button>
        <span className="text-xs text-gray-400 ml-auto">
          Usa el panel de semanas (izquierda) para seleccionar o crear una semana — pasadas incluidas
        </span>
      </div>

      {/* Detail form */}
      {activeMeeting && mergedMeeting ? (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Header toolbar */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-bold text-base text-gray-800">
              {formatWeekRange(activeMeeting.date, locale)}
            </h2>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={autoAssign}
                disabled={autoAssigning}
                title="Auto-asignar presidente, conductor AT, lector y hospitalidad"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded font-medium disabled:opacity-50"
              >
                <Zap size={12} /> {autoAssigning ? 'Asignando…' : 'Auto-asignar'}
              </button>
              <button
                onClick={removeAssignments}
                title="Quitar todas las asignaciones"
                className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 text-gray-500 text-xs rounded"
              >
                <RotateCcw size={12} /> Quitar asignaciones
              </button>
              {isDirty && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs rounded font-medium disabled:opacity-50"
                >
                  <Save size={12} /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
              )}
              <button
                onClick={() => deleteMeeting(activeMeeting.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                title="Eliminar semana"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Speaker + Outline */}
          <section className="mb-4 bg-white border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-gray-700">Discurso Público</span>
              <button
                onClick={() => setSpeakerModalOpen(true)}
                className="text-xs text-sky-600 hover:underline"
              >
                {speakerLabel(mergedMeeting) ? 'Cambiar' : '+ Asignar orador'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-gray-500 block mb-0.5">Orador</label>
                <div className="font-medium text-gray-800">
                  {speakerLabel(mergedMeeting) || <span className="text-gray-400 italic">Sin asignar</span>}
                </div>
                {congregationLabel(mergedMeeting) && (
                  <div className="text-gray-400">{congregationLabel(mergedMeeting)}</div>
                )}
              </div>
              <div>
                <label className="text-gray-500 block mb-0.5">Discurso</label>
                <div className="font-medium text-gray-800">
                  {outlineLabel(mergedMeeting) || <span className="text-gray-400 italic">Sin discurso</span>}
                </div>
              </div>
            </div>
            <div className="mt-2 flex gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Canción</label>
                <input
                  type="number"
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-xs"
                  placeholder="Nº"
                  value={String(getField('song') ?? '')}
                  onChange={e => setField('song', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={Boolean(getField('speaker_confirmed'))}
                  onChange={e => setField('speaker_confirmed', e.target.checked)}
                  className="w-3 h-3"
                />
                Confirmado
              </label>
            </div>
            <div className="mt-2">
              <label className="text-xs text-gray-500 block mb-0.5">Notas</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                placeholder="Notas del discurso..."
                value={String(getField('notes') ?? '')}
                onChange={e => setField('notes', e.target.value)}
              />
            </div>
          </section>

          {/* Weekend Assignments */}
          <section className="mb-4 bg-white border border-gray-200 rounded-lg p-3">
            <div className="font-semibold text-sm text-gray-700 mb-3">Asignaciones de Fin de Semana</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Presidente</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-sky-50"
                  value={String(getField('chairman_id') ?? '')}
                  onChange={e => setField('chairman_id', e.target.value || null)}
                >
                  <option value=""></option>
                  {chairmenPool.map(p => (
                    <option key={p.id} value={p.id}>{personName(p)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Conductor Estudio de La Atalaya</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-sky-50"
                  value={String(getField('wt_conductor_id') ?? '')}
                  onChange={e => setField('wt_conductor_id', e.target.value || null)}
                >
                  <option value=""></option>
                  {wtPool.map(p => (
                    <option key={p.id} value={p.id}>{personName(p)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Lector de La Atalaya</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-sky-50"
                  value={String(getField('wt_reader_id') ?? '')}
                  onChange={e => setField('wt_reader_id', e.target.value || null)}
                >
                  <option value=""></option>
                  {readerPool.map(p => (
                    <option key={p.id} value={p.id}>{personName(p)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-0.5">Hospitalidad</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs bg-yellow-50"
                  value={
                    HOSPITALITY_GROUPS.includes(String(getField('hospitality_text') ?? ''))
                      ? `group:${getField('hospitality_text')}`
                      : String(getField('hospitality_person_id') ?? '')
                  }
                  onChange={e => {
                    const v = e.target.value;
                    if (v.startsWith('group:')) {
                      setField('hospitality_text', v.slice(6));
                      setField('hospitality_person_id', null);
                    } else {
                      setField('hospitality_person_id', v || null);
                      setField('hospitality_text', null);
                    }
                  }}
                >
                  <option value=""></option>
                  <optgroup label="Grupos">
                    {HOSPITALITY_GROUPS.map(g => (
                      <option key={g} value={`group:${g}`}>{g}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Publicadores">
                    {localPersons.map(p => (
                      <option key={p.id} value={p.id}>{personName(p)}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="mt-2">
              <label className="text-xs text-gray-500 block mb-0.5">Nota hospitalidad</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                placeholder="Dirección, notas..."
                value={String(getField('hospitality_text') ?? '')}
                onChange={e => setField('hospitality_text', e.target.value)}
              />
            </div>
          </section>

          {/* Overview table */}
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <span className="font-semibold text-xs text-gray-600 uppercase tracking-wide">Resumen general</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Semana</th>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Orador</th>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Discurso</th>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Presidente</th>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Conductor AT</th>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Lector AT</th>
                    <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Hospitalidad</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map(m => {
                    const isRow = m.id === activeId;
                    const sp = speakerLabel(m);
                    const ol = outlineLabel(m);
                    const ch = personName(m.chairman);
                    const wt = personName(m.wt_conductor);
                    const rd = personName(m.wt_reader);
                    const hp = personName(m.hospitality_person) ||
                      (HOSPITALITY_GROUPS.includes(m.hospitality_text || '') ? m.hospitality_text! : '');
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setActiveId(m.id)}
                        className={`border-b border-gray-100 cursor-pointer ${isRow ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-2 py-1.5 font-medium whitespace-nowrap">{formatWeekRange(m.date, locale)}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{sp || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5 max-w-[180px] truncate">{ol || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{ch || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{wt || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{rd || <span className="text-gray-300">—</span>}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{hp || <span className="text-gray-300">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          Selecciona una semana
        </div>
      )}

      {/* Speaker/Outline modal */}
      {speakerModalOpen && activeMeeting && (
        <PublicSpeakerModal
          outlines={outlines}
          localSpeakers={localSpeakerPool}
          allLocalPersons={localPersons}
          visitingSpeakers={visitingSpeakers}
          onConfirm={handleSpeakerConfirm}
          onClose={() => setSpeakerModalOpen(false)}
          initialSpeakerType={activeMeeting.speaker_type}
          initialLocalSpeakerId={activeMeeting.local_speaker_id}
          initialVisitingSpeakerId={activeMeeting.visiting_speaker_id}
          initialOutlineId={activeMeeting.outline_id}
        />
      )}

      {/* Outline Manager panel */}
      {showOutlineManager && (
        <OutlineManagerPanel
          outlines={outlines}
          onClose={() => setShowOutlineManager(false)}
          onRefresh={onRefresh}
        />
      )}

      {/* Visiting Speaker Manager panel */}
      {showSpeakerManager && (
        <VisitingSpeakerManagerPanel
          speakers={visitingSpeakers}
          outlines={outlines}
          onClose={() => setShowSpeakerManager(false)}
          onRefresh={onRefresh}
        />
      )}

      {/* Past History modal */}
      {showHistory && (
        <PastHistoryModal onClose={() => setShowHistory(false)} />
      )}

      {/* Month print modal */}
      {printOpen && (
        <WeekendPrintModal
          meetings={meetings}
          congregation={congregation ?? null}
          locale={locale}
          onClose={() => setPrintOpen(false)}
        />
      )}
    </div>
  );
}

// ── Past History Modal ──────────────────────────────────────────────────────

function PastHistoryModal({ onClose }: { onClose: () => void }) {
  const [history, setHistory] = React.useState<HistoryRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('/api/public-talk-history')
      .then(r => r.json())
      .then(j => setHistory(j.history || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-sky-600 text-white rounded-t-lg">
          <span className="font-bold text-sm">Historial de Discursos Públicos</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Cargando…</div>
          ) : history.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">Sin historial registrado</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Fecha</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Orador</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Discurso</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-gray-100">
                    <td className="px-3 py-1.5 whitespace-nowrap">{h.date}</td>
                    <td className="px-3 py-1.5">{h.speaker_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5">
                      {h.outline ? `${h.outline.number} - ${h.outline.title}` : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-400">
          {history.length} registro(s)
        </div>
      </div>
    </div>
  );
}

// ── Inline Outline Manager ──────────────────────────────────────────────────

function OutlineManagerPanel({ outlines, onClose, onRefresh }: {
  outlines: PublicTalkOutline[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newNum, setNewNum] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const create = async () => {
    if (!newNum || !newTitle) return;
    await fetch('/api/public-talk-outlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: Number(newNum), title: newTitle }),
    });
    setNewNum(''); setNewTitle(''); setAdding(false);
    onRefresh();
  };

  const update = async (id: string) => {
    await fetch(`/api/public-talk-outlines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle }),
    });
    setEditId(null);
    onRefresh();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este discurso?')) return;
    await fetch(`/api/public-talk-outlines/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-sky-600 text-white rounded-t-lg">
          <span className="font-bold text-sm">Gestionar Discursos Públicos</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 w-12">#</th>
                <th className="text-left px-3 py-2">Título</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {outlines.map(o => (
                <tr key={o.id} className="border-b border-gray-100">
                  <td className="px-3 py-1.5 text-gray-500">{o.number}</td>
                  <td className="px-3 py-1.5">
                    {editId === o.id ? (
                      <div className="flex gap-1">
                        <input
                          className="flex-1 border border-gray-300 rounded px-1 py-0.5 text-xs"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') update(o.id); if (e.key === 'Escape') setEditId(null); }}
                          autoFocus
                        />
                        <button onClick={() => update(o.id)} className="text-sky-600 font-bold text-xs">✓</button>
                        <button onClick={() => setEditId(null)} className="text-gray-400 text-xs">✕</button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-sky-600"
                        onClick={() => { setEditId(o.id); setEditTitle(o.title); }}
                      >{o.title}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => remove(o.id)} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-gray-200">
          {adding ? (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="#"
                className="w-16 border border-gray-300 rounded px-2 py-1 text-xs"
                value={newNum}
                onChange={e => setNewNum(e.target.value)}
              />
              <input
                type="text"
                placeholder="Título del discurso"
                className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && create()}
              />
              <button onClick={create} className="px-3 py-1 bg-sky-600 text-white text-xs rounded">Agregar</button>
              <button onClick={() => setAdding(false)} className="px-2 py-1 text-gray-400 text-xs">✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs text-sky-600 hover:underline"
            >
              <Plus size={12} /> Agregar discurso
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline Visiting Speaker Manager ────────────────────────────────────────

function VisitingSpeakerManagerPanel({ speakers, outlines, onClose, onRefresh }: {
  speakers: PublicSpeaker[];
  outlines: PublicTalkOutline[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', congregation: '', city: '', phone: '', email: '', outlineNums: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  void outlines; // available for future outline picker

  const create = async () => {
    if (!form.name || !form.congregation) return;
    const outline_numbers = form.outlineNums
      .split(',')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));
    await fetch('/api/public-speakers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, outline_numbers }),
    });
    setForm({ name: '', congregation: '', city: '', phone: '', email: '', outlineNums: '' });
    setAdding(false);
    onRefresh();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este orador visitante?')) return;
    await fetch(`/api/public-speakers/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 bg-sky-600 text-white rounded-t-lg">
          <span className="font-bold text-sm">Oradores Visitantes</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {speakers.map(s => (
            <div key={s.id} className="border-b border-gray-100">
              <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <div>
                  <div className="text-xs font-semibold">{s.name}</div>
                  <div className="text-[11px] text-gray-400">{s.congregation}{s.city ? ` — ${s.city}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {expandedId === s.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <button onClick={e => { e.stopPropagation(); remove(s.id); }} className="text-gray-300 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {expandedId === s.id && (
                <div className="px-4 pb-3 text-xs text-gray-500 space-y-1 bg-gray-50">
                  {s.phone && <div>📞 {s.phone}</div>}
                  {s.email && <div>✉️ {s.email}</div>}
                  <div>Discursos: {(s.outline_numbers || []).join(', ') || 'Ninguno registrado'}</div>
                  {s.notes && <div>📝 {s.notes}</div>}
                </div>
              )}
            </div>
          ))}
          {speakers.length === 0 && (
            <div className="p-4 text-center text-xs text-gray-400">Sin oradores visitantes registrados</div>
          )}
        </div>
        <div className="p-3 border-t border-gray-200">
          {adding ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Nombre*" className="border border-gray-300 rounded px-2 py-1 text-xs" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                <input type="text" placeholder="Congregación*" className="border border-gray-300 rounded px-2 py-1 text-xs" value={form.congregation} onChange={e => setForm(p => ({ ...p, congregation: e.target.value }))} />
                <input type="text" placeholder="Ciudad" className="border border-gray-300 rounded px-2 py-1 text-xs" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                <input type="text" placeholder="Teléfono" className="border border-gray-300 rounded px-2 py-1 text-xs" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                <input type="email" placeholder="Email" className="border border-gray-300 rounded px-2 py-1 text-xs" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                <input type="text" placeholder="Discursos (ej. 1,5,18)" className="border border-gray-300 rounded px-2 py-1 text-xs" value={form.outlineNums} onChange={e => setForm(p => ({ ...p, outlineNums: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <button onClick={create} className="px-3 py-1 bg-sky-600 text-white text-xs rounded">Agregar</button>
                <button onClick={() => setAdding(false)} className="px-2 py-1 text-gray-400 text-xs">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-sky-600 hover:underline">
              <Plus size={12} /> Agregar orador visitante
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
