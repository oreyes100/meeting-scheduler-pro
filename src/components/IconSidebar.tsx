'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sun, Moon, LayoutGrid } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { MODULES, moduleByPath } from '@/lib/modules';
import { useMe, canAccess } from '@/lib/useMe';

export function IconSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { mode, setMode } = useTheme();
  const { me } = useMe();
  const isDark = mode === 'dark';

  const visible = MODULES.filter(m => canAccess(me, m.key, m.adminOnly));

  // Gate: si el módulo actual no está permitido, redirigir al primero visible
  const current = moduleByPath(pathname);
  const blocked = !!me && !!current && !canAccess(me, current.key, current.adminOnly);
  useEffect(() => {
    if (blocked) router.replace(visible[0]?.path || '/my-report');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  if (blocked) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900/95 flex items-center justify-center text-white text-sm">
        Sin acceso a este módulo — redirigiendo…
      </div>
    );
  }

  return (
    <div className={`${isDark ? 'bg-gray-900' : 'bg-sky-500'} shrink-0
        flex md:flex-col items-center gap-1 md:gap-2 md:py-3 md:w-[52px]
        fixed bottom-0 left-0 right-0 z-40 h-[52px] px-1 overflow-x-auto
        md:static md:h-auto md:px-0 md:overflow-x-visible md:overflow-y-auto`}>
      <button onClick={() => router.push('/')} title="Inicio"
        className="p-2 rounded-md text-white hover:bg-sky-600 transition-colors shrink-0">
        <LayoutGrid size={22} />
      </button>
      {visible.map(({ key, path, Icon, title }) => {
        const active = pathname === path || pathname?.startsWith(path + '/');
        return (
          <button key={key} onClick={() => router.push(path)} title={title}
            className={`p-2 rounded-md text-white transition-colors shrink-0 ${active ? 'bg-sky-600 shadow-inner' : 'hover:bg-sky-600'}`}>
            <Icon size={22} />
          </button>
        );
      })}
      <div className="hidden md:block md:flex-1" />
      <button onClick={() => setMode(isDark ? 'light' : 'dark')} title="Tema"
        className="p-2 rounded-md text-white hover:bg-sky-600 transition-colors shrink-0">
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </div>
  );
}
