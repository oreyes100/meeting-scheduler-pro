'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Home, RefreshCw, Megaphone, CalendarDays, FileText, Users, Building2, Share2, ClipboardCheck, BookOpen, UserCog, ArrowLeftRight, Database, Archive } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { CongregationForm } from '@/components/CongregationForm';

interface SectionItem {
  key: string;
  label: string;
  Icon: any;
  path?: string; // undefined = no page yet (shown disabled)
}

const SECTIONS: SectionItem[] = [
  { key: 'info', label: 'Información de la Congregación', Icon: Home, path: '/congregation' },
  { key: 'sync', label: 'Sincronización de Congregación', Icon: RefreshCw },
  { key: 'board', label: 'Tablero de anuncios', Icon: Megaphone },
  { key: 'events', label: 'Eventos', Icon: CalendarDays, path: '/events' },
  { key: 's1', label: 'Predicación y Asistencia a las reuniones (S-1)', Icon: FileText, path: '/field-service-reports' },
  { key: 'groups', label: 'Grupos y Familias', Icon: Users, path: '/field-service' },
  { key: 'circuits', label: 'Circuitos, Congregaciones y Oradores', Icon: Building2 },
  { key: 'share-speakers', label: 'Compartir Oradores', Icon: Share2 },
  { key: 'attendance', label: 'Asistencia a las reuniones', Icon: ClipboardCheck, path: '/attendance' },
  { key: 'publications', label: 'Publicaciones', Icon: BookOpen },
  { key: 'responsibilities', label: 'Responsabilidades en la Congregación', Icon: UserCog, path: '/responsibilities' },
  { key: 'import-export', label: 'Importar o exportar', Icon: ArrowLeftRight },
  { key: 'maintain-data', label: 'Mantener Datos', Icon: Database },
  { key: 'backup', label: 'Respaldar y Restaurar', Icon: Archive, path: '/backup' },
];

export default function CongregationPage() {
  const router = useRouter();
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 font-sans">
      <IconSidebar />

      {/* Lista de secciones de Congregación (equivalente al menú Home de NWS) */}
      <nav className={`w-72 shrink-0 border-r overflow-y-auto ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="p-3 text-xs font-bold uppercase text-gray-400 dark:text-gray-500">Congregación</div>
        <ul>
          {SECTIONS.map(({ key, label, Icon, path }) => {
            const active = path === '/congregation';
            const disabled = !path;
            return (
              <li key={key}>
                <button
                  disabled={disabled}
                  title={disabled ? 'Próximamente' : undefined}
                  onClick={() => path && router.push(path)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors ${
                    disabled
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      : active
                      ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1 overflow-hidden">
        <CongregationForm />
      </div>
    </div>
  );
}
