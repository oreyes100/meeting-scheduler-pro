'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { MODULES } from '@/lib/modules';
import { useMe, canAccess } from '@/lib/useMe';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const { me, loading } = useMe();
  const isDark = mode === 'dark';

  const visible = MODULES.filter(m => canAccess(me, m.key, m.adminOnly));

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* Hero */}
      <div className="bg-gradient-to-b from-sky-500 to-sky-400 dark:from-sky-900 dark:to-gray-900 text-white text-center pt-10 pb-8 px-4 relative">
        <div className="absolute top-3 right-3 flex gap-2">
          <button onClick={() => setMode(isDark ? 'light' : 'dark')} className="p-2 rounded-full bg-white/15 hover:bg-white/25" title="Tema">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {me?.authenticated && (
            <button onClick={logout} className="p-2 rounded-full bg-white/15 hover:bg-white/25" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          )}
        </div>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/20 mb-3">
          <Globe size={36} />
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide">MEETING SCHEDULER PRO</h1>
        <p className="text-sm text-white/85 mt-1">Congregación La Estación — Pátzcuaro</p>
        {me?.authenticated && <p className="text-xs text-white/70 mt-1">{me.name} · {me.app_role === 'admin' ? 'Administrador' : me.app_role === 'elder' ? 'Anciano' : 'Publicador'}</p>}
      </div>

      {/* Módulos */}
      <div className="max-w-5xl mx-auto px-4 py-8 pb-20 md:pb-8">
        {loading ? (
          <p className="text-center text-gray-400">Cargando…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map(({ key, path, title, description, Icon }) => (
              <button key={key} onClick={() => router.push(path)}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  isDark ? 'bg-gray-800 border-gray-700 hover:border-sky-600' : 'bg-white border-gray-200 hover:border-sky-400'
                }`}>
                <span className={`p-2.5 rounded-lg shrink-0 ${isDark ? 'bg-sky-900/50 text-sky-300' : 'bg-sky-50 text-sky-600'}`}>
                  <Icon size={22} />
                </span>
                <span>
                  <span className="block font-semibold text-sm">{title}</span>
                  <span className={`block text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
