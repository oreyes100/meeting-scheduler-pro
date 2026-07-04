'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';
import { useMe } from '@/lib/useMe';

function monthISO(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

export default function MyReportPage() {
  const { mode } = useTheme();
  const { me, loading: meLoading } = useMe();
  const isPioneer = !!me?.is_regular_pioneer || !!me?.is_special_pioneer;
  const [month, setMonth] = useState(() => monthISO(-1)); // por defecto: mes anterior
  const [form, setForm] = useState({ participated: true, is_auxiliary_pioneer: false, hours: '' as string, bible_studies: '' as string, notes: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchData = useCallback(async () => {
    if (!me?.user_id) return;
    const from = monthISO(-12);
    const res = await fetch(`/api/field-service-reports?user_id=${me.user_id}&from=${from}&to=${monthISO(0)}`);
    const data = await res.json();
    const reports = data.reports || data.rows || [];
    setHistory(reports);
    const cur = reports.find((r: any) => r.month === month);
    if (cur) {
      setForm({
        participated: !!cur.participated,
        is_auxiliary_pioneer: !!cur.is_auxiliary_pioneer,
        hours: cur.hours != null ? String(cur.hours) : '',
        bible_studies: cur.bible_studies != null ? String(cur.bible_studies) : '',
        notes: cur.notes || '',
      });
    } else {
      setForm({ participated: true, is_auxiliary_pioneer: false, hours: '', bible_studies: '', notes: '' });
    }
    setDirty(false);
    setSaved(false);
  }, [me?.user_id, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async () => {
    if (!me?.user_id) return;
    setSaving(true);
    await fetch('/api/field-service-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: me.user_id,
        month,
        participated: form.participated,
        is_auxiliary_pioneer: form.is_auxiliary_pioneer,
        hours: form.hours ? parseFloat(form.hours) : null,
        bible_studies: form.bible_studies ? parseInt(form.bible_studies) : null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setDirty(false);
    fetchData();
  };

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `w-full border rounded px-2 py-1.5 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;
  const set = (patch: Partial<typeof form>) => { setForm(f => ({ ...f, ...patch })); setDirty(true); setSaved(false); };

  // Meses seleccionables: últimos 3
  const months = [monthISO(0), monthISO(-1), monthISO(-2)];

  return (
    <div className={`flex flex-col md:flex-row h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />
      <SyncStatus pending={dirty} onSync={save} />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 text-white px-4 py-2 shrink-0">
          <h1 className="font-bold text-lg">Mi Informe de Predicación</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {meLoading ? (
            <p className="text-center text-gray-400 mt-10">Cargando…</p>
          ) : !me?.user_id ? (
            <div className={`max-w-md mx-auto mt-10 p-5 rounded-xl border text-center ${bgCard}`}>
              <p className="text-sm">Tu cuenta aún no está vinculada a un publicador.</p>
              <p className="text-xs text-gray-400 mt-2">Pide a un administrador que asocie tu correo <b>{me?.email}</b> en Privilegios.</p>
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-4">
              {/* Formulario */}
              <div className={`p-4 rounded-xl border ${bgCard}`}>
                <label className="block text-xs font-medium mb-1">Mes</label>
                <select className={inputCls} value={month} onChange={e => setMonth(e.target.value)}>
                  {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>

                <label className="flex items-center gap-2 mt-4 text-sm">
                  <input type="checkbox" checked={form.participated} onChange={e => set({ participated: e.target.checked })} />
                  Participé en la predicación este mes
                </label>

                {!isPioneer && (
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input type="checkbox" checked={form.is_auxiliary_pioneer} onChange={e => set({ is_auxiliary_pioneer: e.target.checked })} />
                    Fui precursor auxiliar este mes
                  </label>
                )}

                {(isPioneer || form.is_auxiliary_pioneer) && (
                  <>
                    <label className="block text-xs font-medium mb-1 mt-3">Horas{isPioneer ? ' (precursor)' : ''}</label>
                    <input type="number" inputMode="decimal" min={0} step={0.5} className={inputCls} value={form.hours}
                           onChange={e => set({ hours: e.target.value })} />
                  </>
                )}

                <label className="block text-xs font-medium mb-1 mt-3">Cursos bíblicos</label>
                <input type="number" inputMode="numeric" min={0} className={inputCls} value={form.bible_studies}
                       onChange={e => set({ bible_studies: e.target.value })} />

                <label className="block text-xs font-medium mb-1 mt-3">Notas</label>
                <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })} />

                <button onClick={save} disabled={saving}
                        className="w-full mt-4 bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                  {saved ? <><CheckCircle2 size={16} /> Enviado</> : <><Save size={16} /> {saving ? 'Enviando…' : 'Enviar Informe'}</>}
                </button>
              </div>

              {/* Historial */}
              <div className={`p-4 rounded-xl border ${bgCard}`}>
                <h3 className="font-bold text-sm mb-2">Últimos 12 meses</h3>
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400">Sin informes registrados.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="py-1">Mes</th><th>Participó</th><th>Horas</th><th>Cursos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().map((r: any) => (
                        <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="py-1 capitalize">{monthLabel(r.month)}</td>
                          <td>{r.participated ? '✓' : '—'}</td>
                          <td>{r.hours ?? ''}</td>
                          <td>{r.bible_studies ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
