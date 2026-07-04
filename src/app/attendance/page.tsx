'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';

const MONTH_LABELS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

interface AttendanceRow {
  id?: string;
  meeting_date: string;
  meeting_type: 'midweek' | 'weekend';
  in_person: number | null;
  online: number | null;
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

// Todas las fechas de un día de la semana dado dentro del mes (hasta 5)
function weekdayDatesInMonth(monthIso: string, dayName: string): string[] {
  const [y, m] = monthIso.split('-').map(Number);
  const targetDow = DAY_INDEX[dayName] ?? 0;
  const dates: string[] = [];
  const d = new Date(y, m - 1, 1);
  while (d.getMonth() === m - 1) {
    if (d.getDay() === targetDow) {
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function fmtDate(iso: string): string {
  return iso.replaceAll('-', '/');
}

export default function AttendancePage() {
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [congregation, setCongregation] = useState<{ midweek_meeting_day?: string; weekend_meeting_day?: string } | null>(null);
  const [rows, setRows] = useState<Record<string, AttendanceRow>>({}); // key: `${date}|${type}`
  const [loading, setLoading] = useState(true);
  const [showDates, setShowDates] = useState(true);
  const [showOnline, setShowOnline] = useState(true);

  const midweekDates = useMemo(
    () => congregation ? weekdayDatesInMonth(month, congregation.midweek_meeting_day || 'thursday') : [],
    [month, congregation]
  );
  const weekendDates = useMemo(
    () => congregation ? weekdayDatesInMonth(month, congregation.weekend_meeting_day || 'sunday') : [],
    [month, congregation]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([
        fetch('/api/congregation'),
        fetch(`/api/attendance?from=${month}&to=${addMonths(month, 1)}`),
      ]);
      const cData = await cRes.json();
      const aData = await aRes.json();
      setCongregation(cData.congregation || null);
      const map: Record<string, AttendanceRow> = {};
      for (const r of aData.rows || []) map[`${r.meeting_date}|${r.meeting_type}`] = r;
      setRows(map);
    } catch { /* ignore */ }
    setLoading(false);
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveCell = async (date: string, type: 'midweek' | 'weekend', patch: Partial<AttendanceRow>) => {
    const key = `${date}|${type}`;
    const current = rows[key] || { meeting_date: date, meeting_type: type, in_person: null, online: null };
    const next = { ...current, ...patch };
    setRows(prev => ({ ...prev, [key]: next }));
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (res.ok) {
        const j = await res.json();
        setRows(prev => ({ ...prev, [key]: j.row }));
      }
    } catch { /* ignore */ }
  };

  const monthOptions = useMemo(() => {
    const opts: string[] = [];
    for (let i = 1; i >= -30; i--) opts.push(addMonths(firstOfMonth(new Date()), i));
    return opts;
  }, []);

  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `w-16 text-center border rounded px-1 py-0.5 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;

  function section(title: string, color: string, dates: string[], type: 'midweek' | 'weekend') {
    const cellsFor = (field: 'in_person' | 'online') => dates.map(d => rows[`${d}|${type}`]?.[field] ?? null);
    const weekTotal = (i: number) => (cellsFor('in_person')[i] || 0) + ((showOnline ? cellsFor('online')[i] : 0) || 0);
    const rowTotal = (field: 'in_person' | 'online') => cellsFor(field).reduce((a: number, v) => a + (v || 0), 0);
    const rowAvg = (field: 'in_person' | 'online') => {
      const vals = cellsFor(field).filter(v => v != null) as number[];
      return vals.length ? Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10 : 0;
    };
    const totalSum = dates.reduce((a, _d, i) => a + weekTotal(i), 0);
    const nonEmptyWeeks = dates.filter((_, i) => weekTotal(i) > 0).length;
    const totalAvg = nonEmptyWeeks ? Math.round((totalSum / nonEmptyWeeks) * 10) / 10 : 0;

    return (
      <div className="mb-6">
        <h3 className={`font-bold text-sm mb-2 ${color}`}>{title}</h3>
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-28"></th>
              {dates.map((d, i) => (
                <th key={d} className="px-4 text-center font-semibold">
                  Semana {i + 1}
                  {showDates && <div className="text-xs font-normal text-gray-400">{fmtDate(d)}</div>}
                </th>
              ))}
              {Array.from({ length: 5 - dates.length }).map((_, i) => <th key={`pad-${i}`} className="px-4 w-20"></th>)}
              <th className="px-4 text-center font-semibold">Total</th>
              <th className="px-4 text-center font-semibold">Promedio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pr-2 text-gray-500 dark:text-gray-400">En persona</td>
              {dates.map(d => (
                <td key={d} className="px-4 py-1 text-center">
                  <input type="number" min={0} className={inputCls}
                    value={rows[`${d}|${type}`]?.in_person ?? ''}
                    onChange={e => saveCell(d, type, { in_person: e.target.value === '' ? null : parseInt(e.target.value) })} />
                </td>
              ))}
              {Array.from({ length: 5 - dates.length }).map((_, i) => <td key={`pad-${i}`} />)}
              <td className="px-4 text-center">{rowTotal('in_person')}</td>
              <td className="px-4 text-center">{rowAvg('in_person')}</td>
            </tr>
            {showOnline && (
              <tr>
                <td className="pr-2 text-gray-500 dark:text-gray-400">En línea</td>
                {dates.map(d => (
                  <td key={d} className="px-4 py-1 text-center">
                    <input type="number" min={0} className={inputCls}
                      value={rows[`${d}|${type}`]?.online ?? ''}
                      onChange={e => saveCell(d, type, { online: e.target.value === '' ? null : parseInt(e.target.value) })} />
                  </td>
                ))}
                {Array.from({ length: 5 - dates.length }).map((_, i) => <td key={`pad-${i}`} />)}
                <td className="px-4 text-center">{rowTotal('online')}</td>
                <td className="px-4 text-center">{rowAvg('online')}</td>
              </tr>
            )}
            <tr className="font-bold border-t">
              <td className="pr-2 pt-1">Total</td>
              {dates.map((d, i) => <td key={d} className="px-4 pt-1 text-center">{weekTotal(i)}</td>)}
              {Array.from({ length: 5 - dates.length }).map((_, i) => <td key={`pad-${i}`} />)}
              <td className="px-4 pt-1 text-center">{totalSum}</td>
              <td className="px-4 pt-1 text-center">{totalAvg}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#4BA3E3] to-[#31708f] text-white px-4 py-2 shrink-0">
          <h1 className="font-bold text-lg">Asistencia a las reuniones</h1>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Lista de meses */}
          <div className={`w-48 border-r overflow-y-auto shrink-0 ${bgCard}`}>
            {monthOptions.map(m => (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`w-full text-left px-3 py-1.5 text-sm capitalize ${
                  m === month ? 'bg-yellow-300 text-gray-900 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {monthLabel(m)}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
            ) : !congregation ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configura el día de reunión entre semana y fin de semana en <strong>Información de la Congregación</strong> antes de capturar asistencia.
              </p>
            ) : (
              <>
                {section('Entre semana', 'text-blue-600', midweekDates, 'midweek')}
                {section('Fin de semana', 'text-orange-600', weekendDates, 'weekend')}

                <div className="flex flex-col gap-1.5 mt-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={showDates} onChange={e => setShowDates(e.target.checked)} />
                    Mostrar fechas de reuniones
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={showOnline} onChange={e => setShowOnline(e.target.checked)} />
                    Mostrar asistencia en línea
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
