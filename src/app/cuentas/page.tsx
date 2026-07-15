'use client';

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { IconSidebar } from '@/components/IconSidebar';
import { SyncStatus } from '@/components/SyncStatus';

const CUENTAS_URL = 'https://cuentas-congregacion.vercel.app';

export default function CuentasPage() {
  const { mode } = useTheme();
  const [iframeError, setIframeError] = useState(false);
  const isDark = mode === 'dark';

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans`}>
      <IconSidebar />
      <SyncStatus />

      <div className="flex-1 flex flex-col overflow-hidden pb-[52px] md:pb-0">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 text-white px-4 py-2 shrink-0 flex items-center justify-between">
          <h1 className="font-bold text-lg">Cuentas de la Congregación</h1>
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
  );
}
