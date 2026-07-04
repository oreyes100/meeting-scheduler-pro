'use client';

import React, { useState, useMemo } from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { BACKUP_SECTIONS, ALL_TABLES } from '@/lib/backupSections';

type Format = 'json' | 'csv';
type Mode = 'merge' | 'replace';

export default function BackupPage() {
  const { mode: theme } = useTheme();
  const isDark = theme === 'dark';
  const sectionKeys = Object.keys(BACKUP_SECTIONS);

  const [selected, setSelected] = useState<Set<string>>(new Set(sectionKeys));
  const [format, setFormat] = useState<Format>('json');

  const [file, setFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<Mode>('merge');
  const [confirmText, setConfirmText] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const allSelected = selected.size === sectionKeys.length;
  const isCsvFile = file?.name.toLowerCase().endsWith('.csv');

  const toggleSection = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(sectionKeys));

  const downloadBackup = () => {
    const params = new URLSearchParams();
    if (!allSelected) params.set('sections', [...selected].join(','));
    params.set('format', format);
    window.location.href = `/api/backup?${params.toString()}`;
  };

  const restore = async () => {
    if (!file) return;
    setRestoring(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('mode', restoreMode);
      if (restoreMode === 'replace') form.append('confirm', confirmText);
      if (isCsvFile) form.append('table', targetTable);

      const res = await fetch('/api/restore', { method: 'POST', body: form });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error al restaurar');
      const summary = (j.results || []).map((r: any) => `${r.table}: ${r.rows} filas`).join(', ');
      setResult({ ok: true, message: `Restauración completa — ${summary}` });
    } catch (e: unknown) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Error al restaurar' });
    } finally {
      setRestoring(false);
    }
  };

  const canRestore = !!file && (!isCsvFile || !!targetTable) && (restoreMode === 'merge' || confirmText === 'CONFIRMAR');

  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `border rounded px-2 py-1.5 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-[#4BA3E3] to-[#31708f] text-white px-4 py-2 shrink-0">
          <h1 className="font-bold text-lg">Respaldar y Restaurar</h1>
        </div>

        <div className="flex-1 overflow-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Respaldar */}
          <section className={`border rounded-lg p-4 ${bgCard}`}>
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Download size={16} /> Generar respaldo</h2>

            <label className="flex items-center gap-2 text-sm font-medium mb-2 pb-2 border-b dark:border-gray-700">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Toda la base de datos
            </label>
            <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
              {sectionKeys.map(key => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.has(key)} onChange={() => toggleSection(key)} />
                  {BACKUP_SECTIONS[key].label}
                </label>
              ))}
            </div>

            <div className="flex items-center gap-4 mb-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={format === 'json'} onChange={() => setFormat('json')} /> Formato de la base de datos (JSON)
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} /> CSV
              </label>
            </div>

            <button
              onClick={downloadBackup}
              disabled={selected.size === 0}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              <Download size={14} /> Descargar respaldo
            </button>
          </section>

          {/* Restaurar */}
          <section className={`border rounded-lg p-4 ${bgCard}`}>
            <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Upload size={16} /> Restaurar respaldo</h2>

            <input
              type="file"
              accept=".json,.csv"
              onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); }}
              className="text-sm mb-3 block"
            />

            {isCsvFile && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tabla destino del CSV</label>
                <select className={inputCls} value={targetTable} onChange={e => setTargetTable(e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {ALL_TABLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mb-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={restoreMode === 'merge'} onChange={() => { setRestoreMode('merge'); setConfirmText(''); }} />
                Fusionar (actualiza por ID, no borra nada existente)
              </label>
              <label className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <input type="radio" checked={restoreMode === 'replace'} onChange={() => setRestoreMode('replace')} />
                Reemplazo total (borra las tablas afectadas antes de restaurar)
              </label>
            </div>

            {restoreMode === 'replace' && (
              <div className="mb-3 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded p-3">
                <p className="text-xs text-red-700 dark:text-red-300 flex items-start gap-1.5 mb-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Esto borra permanentemente los datos actuales de la(s) tabla(s) afectadas antes de insertar el respaldo. Escribe <strong>CONFIRMAR</strong> para continuar.
                </p>
                <input
                  className={`${inputCls} w-full`}
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="CONFIRMAR"
                />
              </div>
            )}

            <button
              onClick={restore}
              disabled={!canRestore || restoring}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
            >
              <Upload size={14} /> {restoring ? 'Restaurando…' : 'Restaurar'}
            </button>

            {result && (
              <p className={`mt-3 text-sm ${result.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {result.message}
              </p>
            )}

            <p className="text-xs text-gray-400 mt-4">
              Un CSV restaura una sola tabla a la vez. Para restaurar varias secciones en un solo paso, usa un respaldo en formato JSON.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
