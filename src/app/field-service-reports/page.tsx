'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Printer, X, Check } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';
import { printTableReport, type PrintTableOptions } from '@/lib/printReport';
import { ExportMenu } from '@/components/ExportMenu';

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Report {
  id?: string;
  user_id: string;
  month: string; // YYYY-MM-01
  participated: boolean;
  is_auxiliary_pioneer: boolean;
  hours: number | null;
  bible_studies: number | null;
  notes: string | null;
}

function firstOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return firstOfMonth(d);
}

// Año de servicio: septiembre YYYY → agosto YYYY+1
function serviceYearMonths(startYear: number): string[] {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(startYear, 8 + i, 1); // 8 = septiembre
    months.push(firstOfMonth(d));
  }
  return months;
}

function personName(p: any): string {
  if (!p) return '';
  return p.display_name || p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

function roleLabel(p: any): string {
  const parts: string[] = [];
  if (p?.is_elder) parts.push('A');
  else if (p?.is_ministerial_servant) parts.push('SM');
  if (p?.is_regular_pioneer) parts.push('PR');
  else if (p?.is_special_pioneer) parts.push('PE');
  else if (p?.is_unbaptized_publisher) parts.push('PNB');
  return parts.length ? `(${parts.join(', ')})` : '';
}

function isPioneerFlag(p: any): boolean {
  return !!(p?.is_regular_pioneer || p?.is_special_pioneer);
}

const emptyReport = (userId: string, month: string): Report => ({
  user_id: userId,
  month,
  participated: false,
  is_auxiliary_pioneer: false,
  hours: null,
  bible_studies: null,
  notes: null,
});

type Tab = 'congregation' | 'jw' | 'publishers';

export default function FieldServiceReportsPage() {
  const { mode } = useTheme();
  const [tab, setTab] = useState<Tab>('publishers');
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [publishers, setPublishers] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, Report>>({});
  const [groups, setGroups] = useState<any[]>([]);
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // user_id guardándose
  const [detailUser, setDetailUser] = useState<any | null>(null);
  const [history, setHistory] = useState<Report[]>([]);
  const [serviceYear, setServiceYear] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, rRes, gRes] = await Promise.all([
        fetch('/api/users'),
        fetch(`/api/field-service-reports?month=${month}`),
        fetch('/api/field-service-groups'),
      ]);
      const uData = await uRes.json();
      const rData = await rRes.json();
      const gData = await gRes.json();
      setPublishers((uData.users || []).filter((u: any) =>
        u.is_active !== false && u.status !== 'moved' &&
        (u.is_publisher !== false || u.is_unbaptized_publisher)
      ));
      const map: Record<string, Report> = {};
      for (const r of rData.reports || []) map[r.user_id] = r;
      setReports(map);
      setGroups(gData.groups || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Solo miembros del grupo elegido (tab Publicadores) — vacío = todos los grupos
  const filteredPublishers = useMemo(() => {
    if (!groupFilter) return publishers;
    const g = groups.find((x: any) => x.id === groupFilter);
    if (!g) return publishers;
    const ids = new Set((g.members || []).map((m: any) => m.user_id));
    return publishers.filter(p => ids.has(p.id));
  }, [publishers, groups, groupFilter]);

  // Historial S-21 del publicador seleccionado (año de servicio sep–ago)
  useEffect(() => {
    if (!detailUser) return;
    const months = serviceYearMonths(serviceYear);
    fetch(`/api/field-service-reports?user_id=${detailUser.id}&from=${months[0]}&to=${months[11]}`)
      .then(res => res.json())
      .then(j => setHistory(j.reports || []))
      .catch(() => setHistory([]));
  }, [detailUser, serviceYear]);

  const saveReport = async (r: Report) => {
    setSaving(r.user_id);
    setReports(prev => ({ ...prev, [r.user_id]: r }));
    try {
      const res = await fetch('/api/field-service-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r),
      });
      if (res.ok) {
        const j = await res.json();
        setReports(prev => ({ ...prev, [r.user_id]: j.report }));
      }
    } catch { /* ignore */ }
    setSaving(null);
  };

  const updateField = (userId: string, patch: Partial<Report>) => {
    const current = reports[userId] || emptyReport(userId, month);
    const next = { ...current, month, ...patch };
    // Marcar participación automáticamente al capturar horas/estudios
    if ((patch.hours != null && patch.hours > 0) || (patch.bible_studies != null && patch.bible_studies > 0)) {
      next.participated = true;
    }
    saveReport(next);
  };

  // Categoría del publicador en el mes: precursor regular/especial (flag),
  // auxiliar (flag del informe), o publicador.
  const categoryOf = (p: any): 'regular' | 'auxiliary' | 'publisher' => {
    if (isPioneerFlag(p)) return 'regular';
    if (reports[p.id]?.is_auxiliary_pioneer) return 'auxiliary';
    return 'publisher';
  };

  const totals = useMemo(() => {
    const acc = {
      publisher: { count: 0, reported: 0, studies: 0 },
      auxiliary: { count: 0, reported: 0, hours: 0, studies: 0 },
      regular: { count: 0, reported: 0, hours: 0, studies: 0 },
    };
    for (const p of publishers) {
      const cat = categoryOf(p);
      const r = reports[p.id];
      acc[cat].count++;
      if (r?.participated) {
        acc[cat].reported++;
        acc[cat].studies += r.bible_studies || 0;
        if (cat !== 'publisher') (acc[cat] as any).hours += Number(r.hours) || 0;
      }
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishers, reports]);

  // Datos del mes para imprimir/exportar (respeta el filtro de grupo activo)
  const getMonthData = (): PrintTableOptions => {
    const groupName = groupFilter ? groups.find((g: any) => g.id === groupFilter)?.name : '';
    const rows = filteredPublishers.map(p => {
      const r = reports[p.id];
      const cat = categoryOf(p);
      return [
        personName(p),
        cat === 'regular' ? 'Prec. regular' : cat === 'auxiliary' ? 'Prec. auxiliar' : 'Publicador',
        r?.participated ? 'Sí' : '—',
        cat !== 'publisher' && r?.hours != null ? String(r.hours) : '',
        r?.bible_studies != null ? String(r.bible_studies) : '',
        r?.notes || '',
      ];
    });
    return {
      title: 'Informes de Predicación',
      congName: 'Congregación',
      subtitle: `${monthLabel(month)}${groupName ? ` — ${groupName}` : ''}`,
      columns: ['Publicador', 'Categoría', 'Informó', 'Horas', 'Estudios', 'Notas'],
      rows,
    };
  };

  const printS21 = () => {
    if (!detailUser) return;
    const months = serviceYearMonths(serviceYear);
    const byMonth: Record<string, Report> = {};
    for (const r of history) byMonth[r.month] = r;
    const rows = months.map(m => {
      const r = byMonth[m];
      return [
        monthLabel(m),
        r?.participated ? 'Sí' : '—',
        r?.is_auxiliary_pioneer ? 'Sí' : '',
        r?.hours != null ? String(r.hours) : '',
        r?.bible_studies != null ? String(r.bible_studies) : '',
        r?.notes || '',
      ];
    });
    printTableReport({
      title: `Registro de publicador — ${personName(detailUser)}`,
      congName: 'Congregación',
      subtitle: `Año de servicio ${serviceYear}-${serviceYear + 1}`,
      columns: ['Mes', 'Informó', 'Prec. aux.', 'Horas', 'Estudios', 'Notas'],
      rows,
    });
  };

  const isDark = mode === 'dark';
  const bgMain = isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `border rounded px-1.5 py-0.5 text-sm w-full ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;
  const thCls = `border p-2 text-xs font-bold text-left ${bgCard}`;

  const historyByMonth = useMemo(() => {
    const m: Record<string, Report> = {};
    for (const r of history) m[r.month] = r;
    return m;
  }, [history]);

  const yearTotals = useMemo(() => {
    let hours = 0, studies = 0, reported = 0;
    for (const r of history) {
      if (r.participated) {
        reported++;
        hours += Number(r.hours) || 0;
        studies += r.bible_studies || 0;
      }
    }
    return { hours, studies, reported };
  }, [history]);

  return (
    <div className={`flex h-screen ${bgMain} font-sans`}>
      <IconSidebar />
      <SyncStatus />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4BA3E3] to-[#31708f] text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Predicación y Asistencia a las reuniones (S-1)</h1>
          <div className="flex gap-2 items-center">
            <button onClick={() => setTab('congregation')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'congregation' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Congregación</button>
            <button onClick={() => setTab('jw')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'jw' ? 'bg-white/20' : 'hover:bg-white/10'}`}>JW.org (S-1)</button>
            <button onClick={() => setTab('publishers')} className={`px-3 py-1 rounded text-sm font-medium ${tab === 'publishers' ? 'bg-white/20' : 'hover:bg-white/10'}`}>Publicadores</button>
            <ExportMenu getData={getMonthData} />
          </div>
        </div>

        {/* Navegación de mes — compartida por las 3 pestañas */}
        <div className="flex items-center justify-center gap-4 py-3 shrink-0">
          <button onClick={() => setMonth(addMonths(month, -1))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <ChevronLeft size={24} className="text-blue-600" />
          </button>
          <h2 className="text-lg font-bold text-red-600">{monthLabel(month)}</h2>
          <button onClick={() => setMonth(addMonths(month, 1))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <ChevronRight size={24} className="text-blue-600" />
          </button>
        </div>

        {(tab === 'congregation' || tab === 'jw') && !loading && (
          <div className="px-3 pb-3 shrink-0">
            {tab === 'congregation' ? (
              <CongregationSummary totals={totals} publisherCount={publishers.length} monthLabel={monthLabel(month)} bgCard={bgCard} />
            ) : (
              <JwSummary totals={totals} publisherCount={publishers.length} bgCard={bgCard} />
            )}
          </div>
        )}

        {tab === 'publishers' && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Tabla de captura mensual */}
          <div className="flex-1 flex flex-col overflow-auto p-3">
            {/* Selector de grupo */}
            <div className="flex items-center justify-end gap-2 mb-3">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Grupo</label>
              <select
                className={`text-sm border rounded px-2 py-1 ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
              >
                <option value="">Todos los grupos</option>
                {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {loading ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">Cargando…</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={thCls}>Publicador</th>
                    <th className={`${thCls} text-center w-20`}>Informó</th>
                    <th className={`${thCls} text-center w-20`} title="Precursor auxiliar este mes">Prec. aux.</th>
                    <th className={`${thCls} w-24`}>Horas</th>
                    <th className={`${thCls} w-24`}>Estudios</th>
                    <th className={thCls}>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPublishers.map(p => {
                    const r = reports[p.id] || emptyReport(p.id, month);
                    const cat = categoryOf(p);
                    const showHours = cat !== 'publisher';
                    return (
                      <tr key={p.id} className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-blue-50'}`}>
                        <td className="p-1.5">
                          <button onClick={() => setDetailUser(p)} className="text-left hover:underline">
                            {personName(p)} <span className="text-gray-400 text-xs">{roleLabel(p)}</span>
                          </button>
                          {saving === p.id && <Check size={12} className="inline ml-1 text-green-500" />}
                        </td>
                        <td className="p-1.5 text-center">
                          <input type="checkbox" checked={r.participated}
                            onChange={e => updateField(p.id, { participated: e.target.checked })} />
                        </td>
                        <td className="p-1.5 text-center">
                          {!isPioneerFlag(p) && (
                            <input type="checkbox" checked={r.is_auxiliary_pioneer}
                              onChange={e => updateField(p.id, { is_auxiliary_pioneer: e.target.checked })} />
                          )}
                        </td>
                        <td className="p-1.5">
                          {showHours && (
                            <input type="number" min={0} step={0.5} className={inputCls}
                              value={r.hours ?? ''}
                              onChange={e => updateField(p.id, { hours: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                          )}
                        </td>
                        <td className="p-1.5">
                          <input type="number" min={0} className={inputCls}
                            value={r.bible_studies ?? ''}
                            onChange={e => updateField(p.id, { bible_studies: e.target.value === '' ? null : parseInt(e.target.value) })} />
                        </td>
                        <td className="p-1.5">
                          <input className={inputCls} value={r.notes ?? ''}
                            onChange={e => setReports(prev => ({ ...prev, [p.id]: { ...(prev[p.id] || emptyReport(p.id, month)), month, notes: e.target.value } }))}
                            onBlur={e => updateField(p.id, { notes: e.target.value || null })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Panel S-21 por publicador */}
          {detailUser && (
            <div className={`w-[380px] border-l ${bgCard} p-4 overflow-y-auto shrink-0`}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm">{personName(detailUser)} <span className="text-gray-400 text-xs">{roleLabel(detailUser)}</span></h3>
                <div className="flex gap-1">
                  <button onClick={printS21} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" title="Imprimir registro"><Printer size={16} /></button>
                  <button onClick={() => setDetailUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Registro de publicador (S-21)</p>

              <div className="flex items-center justify-center gap-3 mb-2">
                <button onClick={() => setServiceYear(serviceYear - 1)} className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ChevronLeft size={18} className="text-blue-600" /></button>
                <span className="text-sm font-bold">Año de servicio {serviceYear}–{serviceYear + 1}</span>
                <button onClick={() => setServiceYear(serviceYear + 1)} className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><ChevronRight size={18} className="text-blue-600" /></button>
              </div>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={thCls}>Mes</th>
                    <th className={`${thCls} text-center`}>Informó</th>
                    <th className={`${thCls} text-center`}>Aux.</th>
                    <th className={`${thCls} text-right`}>Horas</th>
                    <th className={`${thCls} text-right`}>Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceYearMonths(serviceYear).map(m => {
                    const r = historyByMonth[m];
                    return (
                      <tr key={m} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} ${m === month ? (isDark ? 'bg-blue-900/30' : 'bg-blue-50') : ''}`}>
                        <td className="p-1.5">{monthLabel(m)}</td>
                        <td className="p-1.5 text-center">{r?.participated ? '✓' : ''}</td>
                        <td className="p-1.5 text-center">{r?.is_auxiliary_pioneer ? '✓' : ''}</td>
                        <td className="p-1.5 text-right">{r?.hours ?? ''}</td>
                        <td className="p-1.5 text-right">{r?.bible_studies ?? ''}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-bold">
                    <td className="p-1.5">Total ({yearTotals.reported} meses)</td>
                    <td></td>
                    <td></td>
                    <td className="p-1.5 text-right">{yearTotals.hours}</td>
                    <td className="p-1.5 text-right">{yearTotals.studies}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

function CongregationSummary({ totals, publisherCount, monthLabel, bgCard }: { totals: any; publisherCount: number; monthLabel: string; bgCard: string }) {
  const totalReported = totals.publisher.reported + totals.auxiliary.reported + totals.regular.reported;
  const totalHours = totals.auxiliary.hours + totals.regular.hours;
  const totalStudies = totals.publisher.studies + totals.auxiliary.studies + totals.regular.studies;
  return (
    <div className={`border rounded-lg ${bgCard} p-3`}>
      <h3 className="font-bold text-sm mb-2">{monthLabel}</h3>
      <table className="text-sm border-collapse w-full">
        <thead>
          <tr>
            <th className="pr-6 text-left font-medium text-gray-500 dark:text-gray-400">Tipo</th>
            <th className="pr-6 text-right font-medium text-gray-500 dark:text-gray-400">Número de informes</th>
            <th className="pr-6 text-right font-medium text-gray-500 dark:text-gray-400">Horas</th>
            <th className="pr-6 text-right font-medium text-gray-500 dark:text-gray-400">Cursos bíblicos</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t">
            <td className="pr-6 py-1">Publicadores</td>
            <td className="pr-6 text-right">{totals.publisher.reported}</td>
            <td className="pr-6 text-right">—</td>
            <td className="pr-6 text-right">{totals.publisher.studies}</td>
          </tr>
          <tr>
            <td className="pr-6 py-1">Precursores Auxiliares</td>
            <td className="pr-6 text-right">{totals.auxiliary.reported}</td>
            <td className="pr-6 text-right">{totals.auxiliary.hours}</td>
            <td className="pr-6 text-right">{totals.auxiliary.studies}</td>
          </tr>
          <tr>
            <td className="pr-6 py-1">Precursores regulares</td>
            <td className="pr-6 text-right">{totals.regular.reported}</td>
            <td className="pr-6 text-right">{totals.regular.hours}</td>
            <td className="pr-6 text-right">{totals.regular.studies}</td>
          </tr>
          <tr className="border-t font-bold">
            <td className="pr-6 py-1">Total</td>
            <td className="pr-6 text-right">{totalReported}</td>
            <td className="pr-6 text-right">{totalHours}</td>
            <td className="pr-6 text-right">{totalStudies}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm mt-3">Publicadores activos <strong>{publisherCount}</strong></p>
    </div>
  );
}

function JwSummary({ totals, publisherCount, bgCard }: { totals: any; publisherCount: number; bgCard: string }) {
  const cards = [
    { label: 'Publicadores', informes: totals.publisher.reported, horas: null as number | null, cursos: totals.publisher.studies },
    { label: 'Precursores Auxiliares', informes: totals.auxiliary.reported, horas: totals.auxiliary.hours, cursos: totals.auxiliary.studies },
    { label: 'Precursores regulares', informes: totals.regular.reported, horas: totals.regular.hours, cursos: totals.regular.studies },
  ];
  return (
    <div>
      <div className={`border rounded-lg ${bgCard} p-3 mb-3`}>
        <p className="text-sm">Publicadores activos <strong>{publisherCount}</strong></p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`border rounded-lg ${bgCard} p-3`}>
            <h4 className="font-bold text-sm mb-2">{c.label}</h4>
            <p className="text-sm">Número de informes <strong>{c.informes}</strong></p>
            {c.horas !== null && <p className="text-sm">Horas <strong>{c.horas}</strong></p>}
            <p className="text-sm">Cursos bíblicos <strong>{c.cursos}</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
}
