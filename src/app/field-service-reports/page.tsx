'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Printer, X, Check } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { printTableReport } from '@/lib/printReport';

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

export default function FieldServiceReportsPage() {
  const { mode } = useTheme();
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [publishers, setPublishers] = useState<any[]>([]);
  const [reports, setReports] = useState<Record<string, Report>>({});
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
      const [uRes, rRes] = await Promise.all([
        fetch('/api/users'),
        fetch(`/api/field-service-reports?month=${month}`),
      ]);
      const uData = await uRes.json();
      const rData = await rRes.json();
      setPublishers((uData.users || []).filter((u: any) =>
        u.is_active !== false && u.status !== 'moved' &&
        (u.is_publisher !== false || u.is_unbaptized_publisher)
      ));
      const map: Record<string, Report> = {};
      for (const r of rData.reports || []) map[r.user_id] = r;
      setReports(map);
    } catch { /* ignore */ }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const printMonth = () => {
    const rows = publishers.map(p => {
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
    printTableReport({
      title: 'Informes de Predicación',
      congName: 'Congregación',
      subtitle: monthLabel(month),
      columns: ['Publicador', 'Categoría', 'Informó', 'Horas', 'Estudios', 'Notas'],
      rows,
    });
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4BA3E3] to-[#31708f] text-white px-4 py-2 flex items-center justify-between shrink-0">
          <h1 className="font-bold text-lg">Informes de Predicación</h1>
          <button onClick={printMonth} className="p-1.5 hover:bg-white/10 rounded" title="Imprimir mes">
            <Printer size={18} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Tabla de captura mensual */}
          <div className="flex-1 flex flex-col overflow-auto p-3">
            {/* Navegación de mes */}
            <div className="flex items-center justify-center gap-4 mb-3">
              <button onClick={() => setMonth(addMonths(month, -1))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <ChevronLeft size={24} className="text-blue-600" />
              </button>
              <h2 className="text-lg font-bold text-red-600">{monthLabel(month)}</h2>
              <button onClick={() => setMonth(addMonths(month, 1))} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <ChevronRight size={24} className="text-blue-600" />
              </button>
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
                  {publishers.map(p => {
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

            {/* Totales del mes (estilo S-1) */}
            {!loading && (
              <div className={`mt-4 border rounded-lg ${bgCard} p-3`}>
                <h3 className="font-bold text-sm mb-2">Totales — {monthLabel(month)}</h3>
                <table className="text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="pr-6 text-left font-medium text-gray-500 dark:text-gray-400">Categoría</th>
                      <th className="pr-6 text-right font-medium text-gray-500 dark:text-gray-400">Informaron</th>
                      <th className="pr-6 text-right font-medium text-gray-500 dark:text-gray-400">Horas</th>
                      <th className="pr-6 text-right font-medium text-gray-500 dark:text-gray-400">Estudios</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="pr-6">Publicadores</td>
                      <td className="pr-6 text-right">{totals.publisher.reported} / {totals.publisher.count}</td>
                      <td className="pr-6 text-right">—</td>
                      <td className="pr-6 text-right">{totals.publisher.studies}</td>
                    </tr>
                    <tr>
                      <td className="pr-6">Precursores auxiliares</td>
                      <td className="pr-6 text-right">{totals.auxiliary.reported}</td>
                      <td className="pr-6 text-right">{totals.auxiliary.hours}</td>
                      <td className="pr-6 text-right">{totals.auxiliary.studies}</td>
                    </tr>
                    <tr>
                      <td className="pr-6">Precursores regulares</td>
                      <td className="pr-6 text-right">{totals.regular.reported} / {totals.regular.count}</td>
                      <td className="pr-6 text-right">{totals.regular.hours}</td>
                      <td className="pr-6 text-right">{totals.regular.studies}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
      </div>
    </div>
  );
}
