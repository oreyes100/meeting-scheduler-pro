'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Save, Database } from 'lucide-react';
import type { CongregationSettings } from '@/types';

const DAYS = [
  ['monday', 'Lunes'], ['tuesday', 'Martes'], ['wednesday', 'Miércoles'],
  ['thursday', 'Jueves'], ['friday', 'Viernes'], ['saturday', 'Sábado'], ['sunday', 'Domingo'],
];

type Form = Partial<CongregationSettings>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 dark:text-gray-300">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100';

export function CongregationForm() {
  const [form, setForm] = useState<Form>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [migrationSql, setMigrationSql] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/congregation');
      if (!res.ok) {
        const msg = String((await res.json()).error || '');
        if (msg.includes('Could not find the table') || msg.includes('schema cache') || msg.includes('does not exist')) {
          setNeedsMigration(true);
          const r = await fetch('/api/migrate-congregation');
          setMigrationSql((await r.json()).sql || '');
        }
        return;
      }
      const j = await res.json();
      setForm(j.congregation || {});
      setNeedsMigration(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof CongregationSettings, v: string) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/congregation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const j = await res.json();
        setForm(j.congregation || form);
        setSavedAt(Date.now());
        setTimeout(() => setSavedAt(null), 2500);
      } else {
        alert((await res.json()).error || 'Error al guardar');
      }
    } finally {
      setSaving(false);
    }
  };

  const copySql = async () => {
    try { await navigator.clipboard.writeText(migrationSql); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  if (loading) return <div className="p-8 text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-300 text-sm">Cargando…</div>;

  if (needsMigration) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">Configuración inicial requerida</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 mb-3">
          La tabla de configuración de la congregación no existe. Ejecuta este SQL en
          <strong> Supabase → SQL Editor</strong>:
        </p>
        <div className="flex justify-end mb-1">
          <button onClick={copySql} className="px-3 py-1 bg-sky-600 text-white rounded text-xs">{copied ? '✓ Copiado' : 'Copiar SQL'}</button>
        </div>
        <textarea readOnly value={migrationSql} className="w-full h-64 border border-gray-300 dark:border-gray-600 rounded p-2 text-[11px] font-mono bg-gray-50 dark:bg-gray-900" />
        <div className="flex gap-2 mt-2">
          <a href="https://supabase.com/dashboard/project/_/sql/new" target="_blank" rel="noreferrer" className="px-4 py-2 bg-green-600 text-white rounded text-sm">Abrir SQL Editor</a>
          <button onClick={load} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm">Ya lo ejecuté → Recargar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Información de la Congregación</h1>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm font-medium disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Guardando…' : savedAt ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre de la congregación"><input className={inputCls} value={form.name || ''} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Número"><input className={inputCls} value={form.number || ''} onChange={e => set('number', e.target.value)} /></Field>
          <Field label="ID de congregación"><input className={inputCls} value={form.congregation_id || ''} onChange={e => set('congregation_id', e.target.value)} /></Field>
          <Field label="Idioma">
            <select className={inputCls} value={form.language || 'es'} onChange={e => set('language', e.target.value)}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Zona horaria"><input className={inputCls} placeholder="(UTC-06:00)" value={form.time_zone || ''} onChange={e => set('time_zone', e.target.value)} /></Field>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm text-gray-600 dark:text-gray-300 mb-3">Reuniones</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reunión de fin de semana — día">
            <select className={inputCls} value={form.weekend_meeting_day || 'sunday'} onChange={e => set('weekend_meeting_day', e.target.value)}>
              {DAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Hora"><input type="time" className={inputCls} value={form.weekend_meeting_time || ''} onChange={e => set('weekend_meeting_time', e.target.value)} /></Field>
          <Field label="Reunión entre semana — día">
            <select className={inputCls} value={form.midweek_meeting_day || 'thursday'} onChange={e => set('midweek_meeting_day', e.target.value)}>
              {DAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Hora"><input type="time" className={inputCls} value={form.midweek_meeting_time || ''} onChange={e => set('midweek_meeting_time', e.target.value)} /></Field>
          <Field label="Salas auxiliares (entre semana)">
            <select className={inputCls} value={form.auxiliary_rooms ?? 0} onChange={e => set('auxiliary_rooms', parseInt(e.target.value))}>
              <option value={0}>Ninguna</option>
              <option value={1}>1 sala auxiliar</option>
              <option value={2}>2 salas auxiliares</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm text-gray-600 dark:text-gray-300 mb-3">Reunión por Zoom</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Zoom Meeting ID"><input className={inputCls} value={form.zoom_meeting_id || ''} onChange={e => set('zoom_meeting_id', e.target.value)} /></Field>
          <Field label="Contraseña"><input className={inputCls} value={form.zoom_password || ''} onChange={e => set('zoom_password', e.target.value)} /></Field>
          <Field label="Enlace Zoom"><input className={inputCls} value={form.zoom_link || ''} onChange={e => set('zoom_link', e.target.value)} /></Field>
          <Field label="Número de marcado"><input className={inputCls} value={form.dial_in_number || ''} onChange={e => set('dial_in_number', e.target.value)} /></Field>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4">
        <h2 className="font-semibold text-sm text-gray-600 dark:text-gray-300 mb-3">Salón del Reino y Circuito</h2>
        <div className="grid grid-cols-1 gap-3">
          <Field label="Dirección del Salón del Reino"><textarea className={inputCls} rows={2} value={form.kingdom_hall_address || ''} onChange={e => set('kingdom_hall_address', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Circuito"><input className={inputCls} value={form.circuit || ''} onChange={e => set('circuit', e.target.value)} /></Field>
            <Field label="Nombre del Superintendente de Circuito"><input className={inputCls} value={form.co_name || ''} onChange={e => set('co_name', e.target.value)} /></Field>
          </div>
          <Field label="Datos de contacto del SC"><textarea className={inputCls} rows={2} value={form.co_contact_details || ''} onChange={e => set('co_contact_details', e.target.value)} /></Field>
        </div>
      </section>

      <p className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-300 flex items-center gap-1">
        <Database size={11} /> Esta información se usa en la impresión de programas y otros módulos.
      </p>
    </div>
  );
}
