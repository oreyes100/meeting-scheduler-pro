'use client';

import React, { useState } from 'react';
import { ExternalLink, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';

const CUENTAS_URL = 'https://cuentas-congregacion-bay.vercel.app';

const THEME_OPTIONS: { value: ThemeMode; icon: React.ReactNode; label: string }[] = [
  { value: 'light', icon: <Sun size={14} />, label: 'Día' },
  { value: 'system', icon: <Monitor size={14} />, label: 'Sistema' },
  { value: 'dark', icon: <Moon size={14} />, label: 'Noche' },
];

export default function CuentasPage() {
  const { mode, setMode } = useTheme();
  const [iframeError, setIframeError] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <IconSidebar />
      <SyncStatus />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 text-white px-4 py-2 shrink-0 flex items-center justify-between gap-2">
          <h1 className="font-bold text-lg">Cuentas de la Congregación</h1>
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  title={opt.label}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors
                    ${mode === opt.value
                      ? 'bg-white text-emerald-700'
                      : 'text-white/80 hover:bg-white/20'}`}
                >
                  {opt.icon}
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              ))}
            </div>
            <a
              href={CUENTAS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm bg-white/20 hover:bg-white/30 rounded px-2 py-1 transition-colors"
            >
              <ExternalLink size={14} />
              Abrir en pestaña nueva
            </a>
          </div>
        </div>

        {/* Body — dark:bg applies to the wrapper around the iframe */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
          {iframeError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No se pudo cargar el módulo de cuentas en esta ventana.
              </p>
              <a
                href={CUENTAS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <ExternalLink size={16} />
                Abrir Cuentas de la Congregación
              </a>
            </div>
          ) : (
            <iframe
              src={CUENTAS_URL}
              className="flex-1 w-full border-0"
              title="Cuentas de la Congregación"
              onError={() => setIframeError(true)}
              allow="clipboard-write"
            />
          )}
        </div>
      </div>
    </div>
  );
}
