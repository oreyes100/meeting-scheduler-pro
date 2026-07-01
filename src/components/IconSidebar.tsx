'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home, Users, Calendar, BookOpen, Mic, MapPin, Briefcase, Eye,
  ClipboardList, Sparkles, Wrench, GlassWater, Wine, CalendarDays,
  FileText, Sun, Moon,
} from 'lucide-react';
import { useTheme } from '@/lib/theme';

const NAV: { path: string; Icon: any; title: string }[] = [
  { path: '/congregation', Icon: Home, title: 'Congregación' },
  { path: '/persons', Icon: Users, title: 'Publicadores' },
  { path: '/meetings', Icon: Calendar, title: 'Entre semana' },
  { path: '/weekend', Icon: BookOpen, title: 'Fin de semana' },
  { path: '/public-talks', Icon: Mic, title: 'Discursos Públicos' },
  { path: '/territories', Icon: MapPin, title: 'Territorios' },
  { path: '/field-service', Icon: Briefcase, title: 'Servicio del Campo' },
  { path: '/field-service-reports', Icon: FileText, title: 'Informes de Predicación' },
  { path: '/public-witnessing', Icon: Eye, title: 'Predicación Pública' },
  { path: '/tasks', Icon: ClipboardList, title: 'Tareas' },
  { path: '/cleaning', Icon: Sparkles, title: 'Limpieza' },
  { path: '/maintenance', Icon: Wrench, title: 'Mantenimiento' },
  { path: '/co-visit', Icon: GlassWater, title: 'Visita Sup. Circuito' },
  { path: '/memorial', Icon: Wine, title: 'Conmemoración' },
  { path: '/events', Icon: CalendarDays, title: 'Eventos' },
];

export function IconSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { mode, setMode } = useTheme();
  const isDark = mode === 'dark';

  return (
    <div className={`w-[52px] ${isDark ? 'bg-gray-900' : 'bg-sky-500'} flex flex-col items-center py-3 gap-2 shrink-0 overflow-y-auto`}>
      {NAV.map(({ path, Icon, title }) => {
        const active = pathname === path || pathname?.startsWith(path + '/');
        return (
          <button key={path} onClick={() => router.push(path)} title={title}
            className={`p-2 rounded-md text-white transition-colors ${active ? 'bg-sky-600 shadow-inner' : 'hover:bg-sky-600'}`}>
            <Icon size={22} />
          </button>
        );
      })}
      <div className="flex-1" />
      <button onClick={() => setMode(isDark ? 'light' : 'dark')} title="Tema"
        className="p-2 rounded-md text-white hover:bg-sky-600 transition-colors">
        {isDark ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </div>
  );
}
