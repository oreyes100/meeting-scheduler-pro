'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, UserPlus, Check, X, Eye, EyeOff, Copy,
  ChevronLeft, ToggleLeft, ToggleRight, Trash2, Pencil, Users,
} from 'lucide-react';
import { useMe } from '@/lib/useMe';
import { MODULES } from '@/lib/modules';

/* ── Types ─────────────────────────────────────────────────── */
interface Congregation {
  id: string; name: string; city: string | null;
  enabled: boolean; enabled_modules: string[]; user_count?: number;
}
interface ProvisionResult {
  congregation: { id: string; name: string; city: string | null };
  user: { id: string; name: string; email: string; username: string | null };
  credentials: { login_identifier: string; password: string; login_url: string };
}

const ALL_KEYS = MODULES.filter(m => !m.superAdminOnly).map(m => m.key);

const inputCls = 'w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500 text-gray-100 placeholder-gray-500';
const lblCls = 'block text-xs text-gray-400 mb-1 mt-3';
const btnPrimary = 'flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed';
const btnSecondary = 'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300';

/* ── Page ───────────────────────────────────────────────────── */
export default function BackendPage() {
  const router = useRouter();
  const { me, loading } = useMe();

  const [congres, setCongres] = useState<Congregation[]>([]);
  const [fetching, setFetching] = useState(true);
  const [globalErr, setGlobalErr] = useState<string | null>(null);

  /* Provisioning state */
  const [prov, setProv] = useState({
    congregation_name: '', congregation_city: '',
    admin_first_name: '', admin_last_name: '',
    admin_email: '', admin_password: '', admin_username: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [provSaving, setProvSaving] = useState(false);
  const [provErr, setProvErr] = useState<string | null>(null);
  const [provResult, setProvResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState(false);

  /* Edit state */
  const [editing, setEditing] = useState<Congregation | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  /* ── Auth guard ─────────────────────────────────────────── */
  useEffect(() => {
    if (!loading && !me?.is_super_admin) router.replace('/login');
  }, [loading, me, router]);

  /* ── Data ───────────────────────────────────────────────── */
  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/super-admin/congregations');
      const d = await res.json();
      setCongres(d.congregations || []);
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : 'Error');
    } finally { setFetching(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Provision ──────────────────────────────────────────── */
  const provision = async () => {
    setProvSaving(true); setProvErr(null); setProvResult(null);
    try {
      const res = await fetch('/api/super-admin/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...prov, enabled_modules: ALL_KEYS }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setProvResult(d);
      setProv({ congregation_name: '', congregation_city: '', admin_first_name: '', admin_last_name: '', admin_email: '', admin_password: '', admin_username: '' });
      await load();
    } catch (e: unknown) { setProvErr(e instanceof Error ? e.message : 'Error'); }
    setProvSaving(false);
  };

  const copyCredentials = () => {
    if (!provResult) return;
    const { credentials: c, congregation: cg, user: u } = provResult;
    navigator.clipboard.writeText(
      `Congregación: ${cg.name}${cg.city ? ` (${cg.city})` : ''}\n` +
      `Administrador: ${u.name}\n` +
      `Usuario/correo: ${c.login_identifier}\n` +
      `Contraseña: ${c.password}\n` +
      `URL: ${c.login_url}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  /* ── Edit congregation ──────────────────────────────────── */
  const saveEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      const res = await fetch('/api/super-admin/congregations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, name: editing.name, city: editing.city, enabled: editing.enabled, enabled_modules: editing.enabled_modules }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(null); await load();
    } catch (e: unknown) { setGlobalErr(e instanceof Error ? e.message : 'Error guardando'); }
    setEditSaving(false);
  };

  const deleteCongre = async (id: string) => {
    if (!confirm('¿Eliminar? Solo posible sin usuarios asignados.')) return;
    try {
      const res = await fetch(`/api/super-admin/congregations?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e: unknown) { setGlobalErr(e instanceof Error ? e.message : 'Error eliminando'); }
  };

  const toggleMod = (key: string) => {
    if (!editing) return;
    const has = editing.enabled_modules.includes(key);
    setEditing({ ...editing, enabled_modules: has ? editing.enabled_modules.filter(k => k !== key) : [...editing.enabled_modules, key] });
  };

  /* ── Render guards ──────────────────────────────────────── */
  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400 text-sm">Verificando acceso…</div>;
  if (!me?.is_super_admin) return null;

  const provReady = prov.congregation_name.trim() && prov.admin_first_name.trim() && prov.admin_email.trim() && prov.admin_password.length >= 8;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* ── Header ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-200 text-sm">
          <ChevronLeft size={16} /> Inicio
        </button>
        <div className="w-px h-5 bg-gray-700" />
        <Building2 size={18} className="text-violet-400" />
        <h1 className="font-bold text-base">Backend · Administración de congregaciones</h1>
        <span className="ml-auto text-xs text-gray-500">{me.name} · super-admin</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {globalErr && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm flex items-center gap-2">
            <X size={13} /> {globalErr}
            <button onClick={() => setGlobalErr(null)} className="ml-auto"><X size={13} /></button>
          </div>
        )}

        {/* ══ SECTION 1: PROVISIONAR ══════════════════════════ */}
        <section>
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <UserPlus size={18} className="text-violet-400" /> Crear congregación + administrador inicial
          </h2>
          <p className="text-sm text-gray-400 mb-5">Un solo paso crea el espacio, la cuenta de acceso y el usuario administrador.</p>

          {/* Result card */}
          {provResult && (
            <div className="mb-6 p-5 rounded-xl border border-green-600 bg-green-900/15">
              <div className="flex items-center gap-2 mb-4">
                <Check size={16} className="text-green-400" />
                <span className="font-semibold text-green-300 text-base">Congregación creada</span>
                <button onClick={copyCredentials}
                  className={`ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${copied ? 'bg-green-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                  <Copy size={11} /> {copied ? 'Copiado' : 'Copiar todo'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Congregación', value: `${provResult.congregation.name}${provResult.congregation.city ? ` — ${provResult.congregation.city}` : ''}` },
                  { label: 'Administrador', value: provResult.user.name },
                  { label: 'Usuario / correo de login', value: provResult.credentials.login_identifier, mono: true, color: 'text-violet-300' },
                  { label: 'Contraseña inicial', value: provResult.credentials.password, mono: true, color: 'text-yellow-300' },
                  { label: 'URL de acceso', value: provResult.credentials.login_url, mono: true, color: 'text-sky-300', full: true },
                ].map(({ label, value, mono, color, full }) => (
                  <div key={label} className={`p-3 rounded-lg bg-gray-800/80 ${full ? 'sm:col-span-2' : ''}`}>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className={`${mono ? 'font-mono text-sm' : 'font-medium'} ${color || ''}`}>{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-yellow-400 mt-4">⚠ Guarda estas credenciales ahora — la contraseña no se puede recuperar.</p>
              <button onClick={() => setProvResult(null)} className={`${btnSecondary} mt-3`}><X size={12} /> Cerrar</button>
            </div>
          )}

          {!provResult && (
            <div className="p-5 rounded-xl border border-gray-700 bg-gray-900">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                {/* Congregación */}
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-1">Congregación</p>
                </div>
                <div>
                  <label className={lblCls}>Nombre *</label>
                  <input value={prov.congregation_name} onChange={e => setProv({ ...prov, congregation_name: e.target.value })} placeholder="La Estación" className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Ciudad</label>
                  <input value={prov.congregation_city} onChange={e => setProv({ ...prov, congregation_city: e.target.value })} placeholder="Pátzcuaro" className={inputCls} />
                </div>

                {/* Separador */}
                <div className="sm:col-span-2 mt-5 mb-1">
                  <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Administrador inicial</p>
                </div>
                <div>
                  <label className={lblCls}>Nombre *</label>
                  <input value={prov.admin_first_name} onChange={e => setProv({ ...prov, admin_first_name: e.target.value })} placeholder="Jorge" className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Apellido</label>
                  <input value={prov.admin_last_name} onChange={e => setProv({ ...prov, admin_last_name: e.target.value })} placeholder="Reyes" className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Correo de acceso *</label>
                  <input type="email" value={prov.admin_email} onChange={e => setProv({ ...prov, admin_email: e.target.value })} placeholder="admin@correo.com" className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>Nombre de usuario (opcional)</label>
                  <input value={prov.admin_username} onChange={e => setProv({ ...prov, admin_username: e.target.value })} placeholder="jreyes" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={lblCls}>Contraseña inicial * (mín. 8 caracteres)</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={prov.admin_password} onChange={e => setProv({ ...prov, admin_password: e.target.value })} placeholder="••••••••" className={`${inputCls} pr-10`} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {provErr && <p className="text-red-400 text-sm mt-3">{provErr}</p>}

              <button onClick={provision} disabled={provSaving || !provReady} className={`${btnPrimary} mt-5`}>
                <Check size={14} /> {provSaving ? 'Creando…' : 'Crear congregación y administrador'}
              </button>
            </div>
          )}
        </section>

        {/* ══ SECTION 2: CONGREGACIONES EXISTENTES ════════════ */}
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-violet-400" /> Congregaciones existentes
            <span className="text-sm font-normal text-gray-400">({congres.length})</span>
          </h2>

          {fetching && <p className="text-gray-500 text-sm">Cargando…</p>}

          <div className="space-y-3">
            {congres.map(c => (
              <div key={c.id} className={`rounded-xl border ${editing?.id === c.id ? 'border-violet-500 bg-gray-900' : 'border-gray-700 bg-gray-900'}`}>
                {editing?.id === c.id ? (
                  /* ── Edit panel ── */
                  <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className={lblCls}>Nombre</label>
                        <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className={lblCls}>Ciudad</label>
                        <input value={editing.city || ''} onChange={e => setEditing({ ...editing, city: e.target.value || null })} className={inputCls} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-sm text-gray-300">Acceso habilitado</span>
                      <button onClick={() => setEditing({ ...editing, enabled: !editing.enabled })} className={editing.enabled ? 'text-green-400' : 'text-gray-600'}>
                        {editing.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">Módulos habilitados</span>
                        <div className="flex gap-3">
                          <button onClick={() => setEditing({ ...editing, enabled_modules: [...ALL_KEYS] })} className="text-xs text-violet-400 hover:text-violet-300">Todos</button>
                          <button onClick={() => setEditing({ ...editing, enabled_modules: [] })} className="text-xs text-red-400 hover:text-red-300">Ninguno</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {MODULES.filter(m => !m.superAdminOnly).map(m => {
                          const on = editing.enabled_modules.includes(m.key);
                          return (
                            <button key={m.key} onClick={() => toggleMod(m.key)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors border ${on ? 'bg-violet-700/50 text-violet-200 border-violet-600' : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'}`}>
                              <m.Icon size={11} className="shrink-0" />
                              <span className="truncate">{m.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={editSaving} className={btnPrimary}><Check size={13} /> {editSaving ? 'Guardando…' : 'Guardar'}</button>
                      <button onClick={() => setEditing(null)} className={btnSecondary}><X size={13} /> Cancelar</button>
                    </div>
                  </div>
                ) : (
                  /* ── Row ── */
                  <div className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${c.enabled ? 'bg-violet-900/40 text-violet-300' : 'bg-gray-800 text-gray-600'}`}>
                      <Building2 size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{c.name}{c.city ? ` — ${c.city}` : ''}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Users size={10} /> {c.user_count ?? 0}</span>
                        <span>{c.enabled_modules.length}/{ALL_KEYS.length} módulos</span>
                        <span className={c.enabled ? 'text-green-400' : 'text-red-400'}>{c.enabled ? 'Activa' : 'Deshabilitada'}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditing({ ...c })} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
                        <Pencil size={11} /> Editar
                      </button>
                      {(c.user_count ?? 0) === 0 && (
                        <button onClick={() => deleteCongre(c.id)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-500 hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!fetching && congres.length === 0 && (
              <p className="text-center text-gray-600 py-10">No hay congregaciones registradas.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
