'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Save, Search, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';
import { MODULES } from '@/lib/modules';

const ROLES = [
  { value: 'admin', label: 'Administrador (todo)' },
  { value: 'elder', label: 'Anciano (todo excepto privilegios)' },
  { value: 'publisher', label: 'Publicador (según permisos)' },
];

const GRANTABLE = MODULES.filter(m => !m.adminOnly && m.key !== 'my-report');

export default function PermissionsPage() {
  const { mode } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/permissions');
    const data = await res.json();
    setUsers(data.users || []);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    await fetch('/api/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: selected.id,
        app_role: selected.app_role,
        permissions: selected.permissions || [],
        auth_email: selected.auth_email || null,
        username: selected.username || null,
      }),
    });
    setUsers(prev => prev.map(u => u.id === selected.id ? selected : u));
    setSaving(false);
    setDirty(false);
  };

  const changePassword = async () => {
    if (!selected || newPassword.length < 6) return;
    setPwSaving(true);
    setPwMsg(null);
    try {
      const res = await fetch('/api/permissions/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selected.id, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la contraseña');
      setPwMsg({ type: 'ok', text: 'Contraseña actualizada.' });
      setNewPassword('');
    } catch (e: unknown) {
      setPwMsg({ type: 'error', text: e instanceof Error ? e.message : 'Error' });
    }
    setPwSaving(false);
  };

  const togglePerm = (key: string) => {
    const perms: string[] = Array.isArray(selected.permissions) ? [...selected.permissions] : [];
    const i = perms.indexOf(key);
    if (i >= 0) perms.splice(i, 1); else perms.push(key);
    setSelected({ ...selected, permissions: perms });
    setDirty(true);
  };

  const isDark = mode === 'dark';
  const bgCard = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputCls = `w-full border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`;
  const name = (u: any) => u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || '(sin nombre)';
  const filtered = users.filter(u => name(u).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`flex flex-col md:flex-row h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />
      <SyncStatus pending={dirty} onSync={save} />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        <div className="bg-gradient-to-r from-gray-700 to-gray-900 text-white px-4 py-2 shrink-0">
          <h1 className="font-bold text-lg">Privilegios de Uso</h1>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Lista usuarios */}
          <div className={`w-full md:w-[300px] border-b md:border-b-0 md:border-r ${bgCard} flex flex-col shrink-0 max-h-[40vh] md:max-h-none`}>
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className={`${inputCls} pl-7`} placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.map(u => (
                <button key={u.id} onClick={() => { setSelected({ ...u }); setDirty(false); setNewPassword(''); setPwMsg(null); }}
                  className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-700 text-sm ${selected?.id === u.id ? (isDark ? 'bg-gray-700' : 'bg-gray-100') : (isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')}`}>
                  <div className="font-medium truncate">{name(u)}</div>
                  <div className="text-xs text-gray-400">{u.app_role || 'publisher'}{u.username ? ` · ${u.username}` : (u.auth_email ? ` · ${u.auth_email}` : '')}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {selected ? (
              <div className="max-w-2xl">
                <h2 className="font-bold text-lg mb-3">{name(selected)}</h2>

                <label className="block text-xs font-medium mb-1">Correo de acceso (login)</label>
                <input className={inputCls} placeholder="correo@ejemplo.com" value={selected.auth_email || ''}
                       onChange={e => { setSelected({ ...selected, auth_email: e.target.value }); setDirty(true); }} />

                <label className="block text-xs font-medium mb-1 mt-3">Nombre de usuario (alternativa al correo)</label>
                <input className={inputCls} placeholder="nombreapellido" value={selected.username || ''}
                       onChange={e => { setSelected({ ...selected, username: e.target.value }); setDirty(true); }} />
                <p className="text-xs text-gray-400 mt-1">Puede iniciar sesión con el correo o con este usuario.</p>

                <div className={`mt-4 p-3 rounded-lg border ${bgCard}`}>
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-1.5"><KeyRound size={15} /> Cambiar contraseña</h3>
                  {!selected.auth_email ? (
                    <p className="text-xs text-gray-400">Vincula un correo de acceso arriba antes de poder asignar contraseña.</p>
                  ) : (
                    <>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} className={`${inputCls} pr-9`} placeholder="Nueva contraseña (mín. 6 caracteres)"
                               value={newPassword} onChange={e => { setNewPassword(e.target.value); setPwMsg(null); }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <button onClick={changePassword} disabled={pwSaving || newPassword.length < 6}
                              className="mt-2 bg-gray-700 dark:bg-gray-600 text-white text-xs py-1.5 px-4 rounded font-medium hover:bg-gray-800 dark:hover:bg-gray-500 disabled:opacity-50">
                        {pwSaving ? 'Guardando…' : 'Cambiar contraseña'}
                      </button>
                      {pwMsg && <p className={`text-xs mt-1.5 ${pwMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{pwMsg.text}</p>}
                    </>
                  )}
                </div>

                <label className="block text-xs font-medium mb-1 mt-4">Rol</label>
                <select className={inputCls} value={selected.app_role || 'publisher'}
                        onChange={e => { setSelected({ ...selected, app_role: e.target.value }); setDirty(true); }}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>

                {(selected.app_role || 'publisher') === 'publisher' && (
                  <>
                    <h3 className="font-bold text-sm mt-5 mb-2">Módulos permitidos</h3>
                    <p className="text-xs text-gray-400 mb-2">“Mi Informe” siempre está disponible para todo publicador.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {GRANTABLE.map(m => {
                        const on = (selected.permissions || []).includes(m.key);
                        return (
                          <label key={m.key} className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-sm ${on ? (isDark ? 'border-sky-600 bg-sky-900/30' : 'border-sky-400 bg-sky-50') : (isDark ? 'border-gray-700' : 'border-gray-200')}`}>
                            <input type="checkbox" checked={on} onChange={() => togglePerm(m.key)} />
                            <m.Icon size={15} className="text-sky-500 shrink-0" />
                            {m.title}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}

                <button onClick={save} disabled={saving || !dirty}
                        className="mt-5 bg-sky-600 text-white text-sm py-1.5 px-5 rounded font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center gap-1">
                  <Save size={14} /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            ) : (
              <p className="text-gray-400 text-center mt-12">Selecciona un publicador para configurar sus privilegios</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
