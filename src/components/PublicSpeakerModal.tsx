'use client';

import React, { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import type { PublicTalkOutline, PublicSpeaker } from '@/types';

interface LocalSpeaker {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

interface Props {
  outlines: PublicTalkOutline[];
  localSpeakers: LocalSpeaker[];
  allLocalPersons?: LocalSpeaker[];
  visitingSpeakers: PublicSpeaker[];
  onConfirm: (result: {
    speakerType: 'local' | 'visiting' | 'other';
    localSpeakerId?: string;
    visitingSpeakerId?: string;
    otherSpeakerName?: string;
    outlineId?: string;
    specialTalkTitle?: string;
  }) => void;
  onClose: () => void;
  initialSpeakerType?: 'local' | 'visiting' | 'other';
  initialLocalSpeakerId?: string | null;
  initialVisitingSpeakerId?: string | null;
  initialOutlineId?: string | null;
}

// Quita diacríticos para búsqueda: "martinez" encuentra "Martínez"
function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function outlineAge(lastDate: string | null | undefined): 'never' | 'fresh' | 'recent' | 'old' | 'very-old' {
  if (!lastDate) return 'never';
  const days = (Date.now() - new Date(lastDate).getTime()) / 86400000;
  if (days < 90) return 'fresh';
  if (days < 180) return 'recent';
  if (days < 365) return 'old';
  return 'very-old';
}

const AGE_BG: Record<string, string> = {
  fresh: 'bg-red-200',
  recent: 'bg-red-100',
  old: 'bg-orange-50',
  'very-old': 'bg-white dark:bg-gray-800',
  never: 'bg-white dark:bg-gray-800',
};

export function PublicSpeakerModal({
  outlines,
  localSpeakers,
  allLocalPersons,
  visitingSpeakers,
  onConfirm,
  onClose,
  initialSpeakerType = 'local',
  initialLocalSpeakerId,
  initialVisitingSpeakerId,
  initialOutlineId,
}: Props) {
  const [speakerType, setSpeakerType] = useState<'local' | 'visiting' | 'other'>(initialSpeakerType);
  const [selectedLocalId, setSelectedLocalId] = useState<string>(initialLocalSpeakerId || '');
  const [selectedVisitingId, setSelectedVisitingId] = useState<string>(initialVisitingSpeakerId || '');
  const [otherName, setOtherName] = useState('');
  const [selectedOutlineId, setSelectedOutlineId] = useState<string>(initialOutlineId || '');
  const [specialTitle, setSpecialTitle] = useState('');
  const [outlineMode, setOutlineMode] = useState<'standard' | 'special'>('standard');
  const [filterBySpeaker, setFilterBySpeaker] = useState(false);
  const [speakerSearch, setSpeakerSearch] = useState('');
  const [congregationFilter, setCongregationFilter] = useState('');
  const [localScope, setLocalScope] = useState<'local' | 'all'>('local');

  // 'local' = only persons with the speaker capability; 'all' = every publisher
  const localSpeakerList = localScope === 'all' && allLocalPersons ? allLocalPersons : localSpeakers;

  // Congregations list from visiting speakers
  const congregations = useMemo(() => {
    const set = new Set(visitingSpeakers.map(s => s.congregation));
    return Array.from(set).sort();
  }, [visitingSpeakers]);

  const filteredVisiting = useMemo(() => {
    let list = visitingSpeakers;
    if (congregationFilter) list = list.filter(s => s.congregation === congregationFilter);
    if (speakerSearch) {
      const q = deaccent(speakerSearch);
      list = list.filter(s => deaccent(s.name).includes(q) || deaccent(s.congregation).includes(q));
    }
    return list;
  }, [visitingSpeakers, congregationFilter, speakerSearch]);

  // Outlines: filter by selected speaker if toggle on
  const currentSpeakerOutlines = useMemo(() => {
    if (!filterBySpeaker) return null;
    if (speakerType === 'visiting' && selectedVisitingId) {
      const sp = visitingSpeakers.find(s => s.id === selectedVisitingId);
      return sp?.outline_numbers ?? null;
    }
    return null;
  }, [filterBySpeaker, speakerType, selectedVisitingId, visitingSpeakers]);

  const filteredOutlines = useMemo(() => {
    if (currentSpeakerOutlines) {
      return outlines.filter(o => currentSpeakerOutlines.includes(o.number));
    }
    return outlines;
  }, [outlines, currentSpeakerOutlines]);

  const speakerName = (sp: LocalSpeaker) =>
    sp.display_name || [sp.first_name, sp.last_name].filter(Boolean).join(' ');

  // Búsqueda sin acentos: "martinez" encuentra "Martínez"
  const speakerHaystack = (sp: LocalSpeaker) =>
    deaccent([sp.display_name, sp.first_name, sp.last_name].filter(Boolean).join(' '));

  const canConfirm =
    (speakerType === 'local' && selectedLocalId) ||
    (speakerType === 'visiting' && selectedVisitingId) ||
    (speakerType === 'other' && otherName.trim());

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      speakerType,
      localSpeakerId: speakerType === 'local' ? selectedLocalId : undefined,
      visitingSpeakerId: speakerType === 'visiting' ? selectedVisitingId : undefined,
      otherSpeakerName: speakerType === 'other' ? otherName.trim() : undefined,
      outlineId: outlineMode === 'standard' ? selectedOutlineId || undefined : undefined,
      specialTalkTitle: outlineMode === 'special' ? specialTitle.trim() || undefined : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-600 to-sky-500 text-white rounded-t-lg">
          <span className="font-bold text-sm">Seleccionar Orador Público y Discurso</span>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Speaker selection */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Speaker type tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {(['local', 'visiting', 'other'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSpeakerType(t)}
                  className={`flex-1 py-2 text-xs font-semibold capitalize border-b-2 transition-colors ${
                    speakerType === t ? 'border-sky-500 text-sky-700 bg-sky-50 dark:bg-sky-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
                  }`}
                >
                  {t === 'local' ? 'Local' : t === 'visiting' ? 'Visitante' : 'Otro'}
                </button>
              ))}
            </div>

            {speakerType === 'local' && (
              <div className="flex flex-col flex-1 overflow-hidden p-2 gap-2">
                <div className="flex gap-1">
                  <select
                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                    value={localScope}
                    onChange={e => { setLocalScope(e.target.value as 'local' | 'all'); setSelectedLocalId(''); }}
                    title="Mostrar solo oradores con permiso, o todos los publicadores"
                  >
                    <option value="local">Solo oradores</option>
                    <option value="all">Todos</option>
                  </select>
                  <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 flex-1">
                    <Search size={12} className="text-gray-400 dark:text-gray-300" />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      className="flex-1 text-xs outline-none"
                      value={speakerSearch}
                      onChange={e => setSpeakerSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                  {localSpeakerList
                    .filter(s => !speakerSearch || speakerHaystack(s).includes(deaccent(speakerSearch)))
                    .map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedLocalId(s.id)}
                        className={`w-full text-left px-3 py-1.5 text-xs border-b border-gray-100 dark:border-gray-700 ${
                          selectedLocalId === s.id ? 'bg-yellow-100 font-semibold' : 'hover:bg-sky-50 dark:hover:bg-sky-950/30 dark:bg-sky-950/30'
                        }`}
                      >
                        {speakerName(s)}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {speakerType === 'visiting' && (
              <div className="flex flex-col flex-1 overflow-hidden p-2 gap-2">
                <div className="flex gap-1">
                  <select
                    className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1"
                    value={congregationFilter}
                    onChange={e => { setCongregationFilter(e.target.value); setSelectedVisitingId(''); }}
                  >
                    <option value="">Todas las congregaciones</option>
                    {congregations.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1">
                  <Search size={12} className="text-gray-400 dark:text-gray-300" />
                  <input
                    type="text"
                    placeholder="Buscar orador..."
                    className="flex-1 text-xs outline-none"
                    value={speakerSearch}
                    onChange={e => setSpeakerSearch(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1 font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-300">Nombre</th>
                        <th className="text-left px-2 py-1 font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-300">Congregación</th>
                        <th className="text-left px-2 py-1 font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-300">Último</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVisiting.map(s => (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedVisitingId(s.id)}
                          className={`cursor-pointer border-b border-gray-100 dark:border-gray-700 ${
                            selectedVisitingId === s.id ? 'bg-yellow-100' : 'hover:bg-sky-50 dark:hover:bg-sky-950/30 dark:bg-sky-950/30'
                          }`}
                        >
                          <td className="px-2 py-1">{s.name}</td>
                          <td className="px-2 py-1 text-gray-500 dark:text-gray-400 dark:text-gray-300">{s.congregation}</td>
                          <td className="px-2 py-1 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-300">{s.last_given_date?.slice(0, 10) ?? ''}</td>
                        </tr>
                      ))}
                      {filteredVisiting.length === 0 && (
                        <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-300">Sin oradores visitantes</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {speakerType === 'other' && (
              <div className="p-4 flex flex-col gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-300">Nombre del orador</label>
                <input
                  type="text"
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                  placeholder="Ej. Superintendente de circuito"
                  value={otherName}
                  onChange={e => setOtherName(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* RIGHT: Outline selection */}
          <div className="w-1/2 flex flex-col">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setOutlineMode('standard')}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  outlineMode === 'standard' ? 'border-sky-500 text-sky-700 bg-sky-50 dark:bg-sky-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
                }`}
              >
                Discurso Estándar
              </button>
              <button
                onClick={() => setOutlineMode('special')}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  outlineMode === 'special' ? 'border-sky-500 text-sky-700 bg-sky-50 dark:bg-sky-950/30' : 'border-transparent text-gray-500 dark:text-gray-400 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900'
                }`}
              >
                Especial
              </button>
            </div>

            {outlineMode === 'standard' && (
              <div className="flex flex-col flex-1 overflow-hidden p-2 gap-2">
                {speakerType === 'visiting' && selectedVisitingId && (
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterBySpeaker}
                      onChange={e => setFilterBySpeaker(e.target.checked)}
                      className="w-3 h-3"
                    />
                    Mostrar solo discursos que puede dar
                  </label>
                )}
                <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1 w-8 font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-300">#</th>
                        <th className="text-left px-2 py-1 font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-300">Título</th>
                        <th className="text-left px-2 py-1 w-24 font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-300">Último</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOutlines.map(o => {
                        const age = outlineAge(o.last_given_date);
                        const bg = selectedOutlineId === o.id
                          ? 'bg-yellow-100'
                          : AGE_BG[age];
                        return (
                          <tr
                            key={o.id}
                            onClick={() => setSelectedOutlineId(o.id)}
                            className={`cursor-pointer border-b border-gray-100 dark:border-gray-700 ${bg} hover:brightness-95`}
                          >
                            <td className="px-2 py-1 text-gray-500 dark:text-gray-400 dark:text-gray-300">{o.number}</td>
                            <td className="px-2 py-1">{o.title}</td>
                            <td className="px-2 py-1 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-300 text-[10px]">
                              {o.last_given_date ? (
                                <span>{o.last_given_date.slice(0, 10)}<br />{o.last_given_speaker}</span>
                              ) : ''}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredOutlines.length === 0 && (
                        <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-300">Sin discursos</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Legend */}
                <div className="flex gap-3 text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-300 pt-1">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-200 border border-gray-200 dark:border-gray-700 inline-block rounded-sm" />Reciente (&lt;3 meses)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-gray-200 dark:border-gray-700 inline-block rounded-sm" />6 meses</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-50 border border-gray-200 dark:border-gray-700 inline-block rounded-sm" />1 año</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 inline-block rounded-sm" />Antiguo</span>
                </div>
              </div>
            )}

            {outlineMode === 'special' && (
              <div className="p-4 flex flex-col gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-300">Título del discurso especial</label>
                <input
                  type="text"
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
                  placeholder="Ej. Visita del Superintendente de Circuito"
                  value={specialTitle}
                  onChange={e => setSpecialTitle(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded text-gray-600 dark:text-gray-400 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            ✕ Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-1.5 text-sm bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-40"
          >
            ✓ Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
