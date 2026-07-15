'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Check, X, ChevronLeft, Users, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { useMe } from '@/lib/useMe';
import { MODULES } from '@/lib/modules';

interface Congregation {
  id: string;
  name: string;
  city: string | null;
  enabled: boolean;
  enabled_modules: string[];
  user_count?: number;
  created_at: string;
}

const ALL_MODULE_KEYS = MODULES.filter(m => !m.superAdminOnly).map(m => m.key);

export default function SuperAdminPage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const [congres, setCongres] = useState<Congregation[]>([]);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState<Congregation | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !me?.is_super_admin) router.push('/');
  }, [loading, me, router]);

  const load = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/super-admin/congregations');
      const d = await res.json();
      setCongres(d.congregations || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando congregaciones');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/congregations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, name: editing.name, city: editing.city, enabled: editing.enabled, enabled_modules: editing.enabled_modules }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
      setEditing(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/congregations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), city: newCity.trim() || null, enabled_modules: ALL_MODULE_KEYS }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCreating(false);
      setNewName('');
      setNewCity('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando');
    } finally {
      setSaving(false);
    }
  };

  const deleteCongre = async (id: string) => {
    if (!confirm('¿Eliminar congregación? Solo es posible si no tiene usuarios asignados.')) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/congregations?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando');
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (mod: string) => {
    if (!editing) return;
    const has = editing.enabled_modules.includes(mod);
    setEditing({ ...editing, enabled_modules: has ? editing.enabled_modules.filter(k => k !== mod) : [...editing.enabled_modules, mod] });
  };

  const enableAll = () => editing && setEditing({ ...editing, enabled_modules: [...ALL_MODULE_KEYS] });
  const disableAll = () => editing && setEditing({ ...editing, enabled_modules: [] });

  if (loading || fetching) return <div className="flex items-center justify-center h-screen text-gray-400">Cargando…</div>;
  if (!me?.is_super_admin) return null;

  const isCls = 'flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium';

  return (
    <div className="h-screen overflow-y-auto bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-b from-violet-700 to-violet-600 text-white px-4 pt-8 pb-6">
        <button onClick={() => router.push('/')} className="flex items-center gap-1 text-white/70 hover:text-white mb-4 text-sm">
          <ChevronLeft size={16} /> Inicio
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/20"><Building2 size={24} /></div>
          <div>
            <h1 className="text-xl font-bold">Super Administrador</h1>
            <p className="text-white/75 text-sm">Gestión de congregaciones</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 pb-20">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm flex items-center gap-2">
            <X size={14} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Create form */}
        {creating ? (
          <div className="mb-6 p-4 rounded-xl border border-violet-600 bg-violet-900/20">
            <h2 className="font-semibold mb-3 text-violet-300">Nueva Congregación</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="La Estación" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ciudad</label>
                <input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="Pátzcuaro" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-3">Se habilitarán todos los módulos por defecto. Podrás ajustarlos después.</p>
            <div className="flex gap-2">
              <button onClick={create} disabled={saving || !newName.trim()} className={`${isCls} bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50`}>
                <Check size={13} /> Crear
              </button>
              <button onClick={() => { setCreating(false); setNewName(''); setNewCity(''); }} className={`${isCls} bg-gray-700 hover:bg-gray-600 text-gray-200`}>
                <X size={13} /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className={`${isCls} mb-6 bg-violet-600 hover:bg-violet-700 text-white`}>
            <Plus size={14} /> Nueva Congregación
          </button>
        )}

        {/* Congregations list */}
        <div className="space-y-4">
          {congres.map(c => (
            <div key={c.id} className={`rounded-xl border ${editing?.id === c.id ? 'border-violet-500 bg-violet-900/10' : 'border-gray-700 bg-gray-800'}`}>
              {editing?.id === c.id ? (
                /* Edit panel */
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                      <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Ciudad</label>
                      <input value={editing.city || ''} onChange={e => setEditing({ ...editing, city: e.target.value })} className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                    </div>
                  </div>

                  {/* Enabled toggle */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm text-gray-300">Acceso habilitado</span>
                    <button onClick={() => setEditing({ ...editing, enabled: !editing.enabled })} className={editing.enabled ? 'text-green-400' : 'text-gray-600'}>
                      {editing.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>

                  {/* Modules */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-300">Módulos habilitados</span>
                      <div className="flex gap-2">
                        <button onClick={enableAll} className="text-xs text-violet-400 hover:text-violet-300">Todos</button>
                        <button onClick={disableAll} className="text-xs text-red-400 hover:text-red-300">Ninguno</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {MODULES.filter(m => !m.superAdminOnly).map(m => {
                        const on = editing.enabled_modules.includes(m.key);
                        return (
                          <button key={m.key} onClick={() => toggleModule(m.key)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${on ? 'bg-violet-700/60 text-violet-200 border border-violet-600' : 'bg-gray-700/50 text-gray-500 border border-gray-700'}`}>
                            <m.Icon size={11} className="shrink-0" />
                            <span className="truncate">{m.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={save} disabled={saving} className={`${isCls} bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50`}>
                      <Check size={13} /> Guardar
                    </button>
                    <button onClick={() => setEditing(null)} className={`${isCls} bg-gray-700 hover:bg-gray-600 text-gray-200`}>
                      <X size={13} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* Summary row */
                <div className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${c.enabled ? 'bg-violet-900/40 text-violet-300' : 'bg-gray-700 text-gray-500'}`}>
                    <Building2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{c.name}{c.city ? ` — ${c.city}` : ''}</div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Users size={11} /> {c.user_count ?? 0} usuarios</span>
                      <span>{c.enabled_modules.length}/{ALL_MODULE_KEYS.length} módulos</span>
                      <span className={c.enabled ? 'text-green-400' : 'text-red-400'}>{c.enabled ? 'Activa' : 'Deshabilitada'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing({ ...c })} className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300">
                      Editar
                    </button>
                    {(c.user_count ?? 0) === 0 && (
                      <button onClick={() => deleteCongre(c.id)} className="text-xs p-1.5 rounded-lg bg-gray-700 hover:bg-red-900/60 text-gray-400 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {congres.length === 0 && !fetching && (
            <p className="text-center text-gray-500 py-8">No hay congregaciones. Crea la primera.</p>
          )}
        </div>
      </div>
    </div>
  );
}
