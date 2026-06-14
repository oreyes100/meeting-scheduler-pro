'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { WeekendDashboard } from '@/components/WeekendDashboard';
import { Sidebar } from '@/components/Sidebar';
import type { WeekendMeeting, PublicTalkOutline, PublicSpeaker } from '@/types';
import { useT } from '@/lib/i18n';

export default function WeekendPage() {
  const { locale } = useT();
  const safeLocale = (locale === 'es' ? 'es' : 'en') as 'en' | 'es';
  const [meetings, setMeetings] = useState<WeekendMeeting[]>([]);
  const [outlines, setOutlines] = useState<PublicTalkOutline[]>([]);
  const [visitingSpeakers, setVisitingSpeakers] = useState<PublicSpeaker[]>([]);
  const [localPersons, setLocalPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [mRes, oRes, spRes, pRes] = await Promise.all([
        fetch('/api/weekend-meetings'),
        fetch('/api/public-talk-outlines'),
        fetch('/api/public-speakers'),
        fetch('/api/persons?limit=500'),
      ]);

      if (!mRes.ok) {
        const err = await mRes.json();
        if (err.error?.includes('does not exist') || err.error?.includes('relation')) {
          setMigrationNeeded(true);
          setLoading(false);
          return;
        }
        throw new Error(err.error || 'Error cargando reuniones');
      }

      const [mj, oj, spj, pj] = await Promise.all([mRes.json(), oRes.json(), spRes.json(), pRes.json()]);
      setMeetings(mj.meetings || []);
      setOutlines(oj.outlines || []);
      setVisitingSpeakers(spj.speakers || []);
      setLocalPersons(pj.persons || []);
      setMigrationNeeded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runMigration = async () => {
    setMigrating(true);
    try {
      const res = await fetch('/api/migrate-weekend', { method: 'POST' });
      const j = await res.json();
      if (j.success) {
        await fetchData();
      } else {
        setError(`Migración fallida. Ejecuta update_schema_weekend.sql en el SQL Editor de Supabase.\n\n${(j.errors || []).join('\n')}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en migración');
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Cargando…</div>;
  }

  if (migrationNeeded) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-center max-w-md">
          <h2 className="text-lg font-bold text-gray-700 mb-2">Configuración inicial requerida</h2>
          <p className="text-sm text-gray-500 mb-4">
            Las tablas de Reunión de Fin de Semana no existen aún. Haz clic para aplicar la migración automáticamente,
            o ejecuta <code className="bg-gray-100 px-1 rounded">update_schema_weekend.sql</code> en el SQL Editor de Supabase.
          </p>
          <button
            onClick={runMigration}
            disabled={migrating}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded text-sm disabled:opacity-50"
          >
            {migrating ? 'Aplicando migración…' : 'Aplicar migración y continuar'}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-red-500 text-sm whitespace-pre">{error}</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        meetings={[]}
        activeMeetingId={null}
        setActiveMeetingId={() => {}}
        onPrint={() => {}}
        onNewMeeting={() => {}}
        isCreating={false}
      />
      <div className="flex-1 overflow-hidden">
        <WeekendDashboard
          meetings={meetings}
          outlines={outlines}
          visitingSpeakers={visitingSpeakers}
          localPersons={localPersons}
          locale={safeLocale}
          onRefresh={fetchData}
        />
      </div>
    </div>
  );
}
