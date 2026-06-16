'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Users, Calendar, MapPin, Smartphone, UserX, Printer, HelpCircle, ChevronDown, ChevronRight, Plus, BookOpen, Home, Sun, Moon, Monitor } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { LanguageSwitcher } from './LanguageSwitcher';
import { formatWeekRange } from '@/lib/weekLabel';

interface SidebarProps {
  meetings: any[];
  activeMeetingId: string | null;
  setActiveMeetingId: (id: string) => void;
  onPrint: () => void;
  onNewMeeting: (specificDate?: string) => void;
  isCreating: boolean;
  allowPast?: boolean;       // allow clicking/creating past weeks (weekend historical entry)
  monthsBack?: number;       // how many months before current to show
}

const MONTHS_TO_SHOW = 6; // current month + next 5

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getMonthKey(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' });
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function Sidebar({ meetings, activeMeetingId, setActiveMeetingId, onPrint, onNewMeeting, isCreating, allowPast = false, monthsBack = 0 }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, locale } = useT();
  const { mode, setMode } = useTheme();
  const cycleTheme = () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    setMode(order[(order.indexOf(mode) + 1) % order.length]);
  };
  const ThemeIcon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;

  // Today's date (client-only) — used to filter past months
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date());
  }, []);

  // Build the calendar: from the first day of the current month through the last day of (current + MONTHS_TO_SHOW - 1) months
  type Week = { isoDate: string; meeting: any | null };
  type Month = { key: string; weeks: Week[] };
  const calendar: { months: Month[] } = useMemo(() => {
    if (!today) return { months: [] };
    const start = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
    const end = addMonths(start, MONTHS_TO_SHOW - 1 + monthsBack);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // last day of (start + MONTHS_TO_SHOW - 1)

    // Map existing meetings by ISO date for O(1) lookup
    const meetingsByDate: Record<string, any> = {};
    for (const m of meetings) {
      if (!m.date) continue;
      meetingsByDate[m.date.slice(0, 10)] = m;
    }

    // Iterate week by week from the Monday on or before `start` to the Monday on or before `end`
    const monthsMap: Record<string, Month> = {};
    const cursor = getMondayOf(start);
    while (cursor <= end) {
      const monthKey = getMonthKey(cursor, locale);
      if (!monthsMap[monthKey]) monthsMap[monthKey] = { key: monthKey, weeks: [] };
      const iso = isoDate(cursor);
      monthsMap[monthKey].weeks.push({
        isoDate: iso,
        meeting: meetingsByDate[iso] || null,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return { months: Object.values(monthsMap) };
  }, [meetings, today, locale, monthsBack]);

  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  // Auto-expand the current month and the month containing the active meeting
  useEffect(() => {
    if (!today) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedMonths((prev) => {
      const next = { ...prev };
      // Expand the current month
      const currentMonthKey = getMonthKey(today, locale);
      next[currentMonthKey] = true;
      // Expand the month of the active meeting, if any
      if (activeMeetingId) {
        const active = meetings.find((m) => m.id === activeMeetingId);
        if (active?.date) {
          const d = new Date(active.date);
          if (!isNaN(d.getTime())) {
            next[getMonthKey(d, locale)] = true;
          }
        }
      }
      // Expand the next month so the user sees what's coming
      const nextMonth = addMonths(today, 1);
      next[getMonthKey(nextMonth, locale)] = true;
      return next;
    });
  }, [meetings, activeMeetingId, today, locale]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => ({ ...prev, [month]: !prev[month] }));
  };

  const getWeekLabel = (date: Date): string => {
    const iso = date.toISOString().slice(0, 10);
    return formatWeekRange(iso, locale);
  };

  return (
    <div className="flex h-full bg-white dark:bg-gray-800 border-r border-border text-sm overflow-hidden select-none">
      {/* 1. Leftmost Mini Icon Bar */}
      <div className="w-14 bg-sky-500 dark:bg-gray-900 flex flex-col items-center py-4 space-y-6 text-white flex-shrink-0">
        <button onClick={() => router.push('/congregation')} className={`p-2 hover:bg-sky-600 rounded-md transition-colors ${pathname?.startsWith('/congregation') ? 'bg-sky-600 shadow-inner' : ''}`} title="Congregación"><Home size={24} /></button>
        <button onClick={() => router.push('/persons')} className={`p-2 hover:bg-sky-600 rounded-md transition-colors ${pathname?.startsWith('/persons') ? 'bg-sky-600' : ''}`} title={t('sidebar.tooltip.persons')}><Users size={24} /></button>
        <button onClick={() => router.push('/meetings')} className={`p-2 hover:bg-sky-600 rounded-md transition-colors ${pathname?.startsWith('/meetings') ? 'bg-sky-600 shadow-inner' : ''}`} title={t('sidebar.tooltip.schedule')}><Calendar size={24} /></button>
        <button onClick={() => router.push('/weekend')} className={`p-2 hover:bg-sky-600 rounded-md transition-colors ${pathname?.startsWith('/weekend') ? 'bg-sky-600 shadow-inner' : ''}`} title="Reunión Fin de Semana"><BookOpen size={24} /></button>
        <button onClick={() => router.push('/territories')} className={`p-2 hover:bg-sky-600 rounded-md transition-colors ${pathname?.startsWith('/territories') ? 'bg-sky-600 shadow-inner' : ''}`} title={t('sidebar.tooltip.territories')}><MapPin size={24} /></button>
        <button onClick={() => alert('Mobile Sync module coming soon!')} className="p-2 hover:bg-sky-600 rounded-md transition-colors" title={t('sidebar.tooltip.mobile')}><Smartphone size={24} /></button>
        <div className="flex-1"></div>
        <button onClick={() => alert('Alerts coming soon!')} className="p-2 hover:bg-sky-600 rounded-md transition-colors relative" title={t('sidebar.tooltip.alerts')}>
          <UserX size={24} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <button onClick={onPrint} className="p-2 hover:bg-sky-600 rounded-md transition-colors" title={t('sidebar.tooltip.print')}><Printer size={24} /></button>
        <button onClick={cycleTheme} className="p-2 hover:bg-sky-600 rounded-md transition-colors" title={`Tema: ${mode === 'light' ? 'claro' : mode === 'dark' ? 'oscuro' : 'según sistema'}`}><ThemeIcon size={24} /></button>
        <button onClick={() => alert('Help center coming soon!')} className="p-2 hover:bg-sky-600 rounded-md transition-colors" title={t('sidebar.tooltip.help')}><HelpCircle size={24} /></button>
      </div>

      {/* 2. Secondary Sidebar: Congregation and Months/Weeks */}
      <div className="flex-1 flex flex-col w-56 flex-shrink-0">
        {/* Congregation Selector Header */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <div className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 flex justify-between items-center cursor-pointer">
            <span className="font-medium text-gray-700 dark:text-gray-300">{t('sidebar.congregation')}</span>
            <ChevronDown size={14} className="text-gray-500 dark:text-gray-400 dark:text-gray-300" />
          </div>
          <div className="mt-2 px-1 flex items-center justify-between">
            <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{t('sidebar.language')}</span>
            <LanguageSwitcher />
          </div>
        </div>

        {/* Scrollable list of months and weeks */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {!today ? (
            <div className="text-gray-500 dark:text-gray-400 dark:text-gray-300 p-2 text-center text-xs">{t('sidebar.loading')}</div>
          ) : calendar.months.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400 dark:text-gray-300 p-2 text-center text-xs">{t('sidebar.emptyWeeks')}</div>
          ) : (
            calendar.months.map((month) => (
              <div key={month.key} className="mb-2">
                <button
                  onClick={() => toggleMonth(month.key)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 rounded text-sky-600 border border-sky-200 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 transition-colors"
                >
                  {expandedMonths[month.key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="font-semibold text-xs tracking-wider uppercase">{month.key}</span>
                </button>

                {expandedMonths[month.key] && (
                  <div className="mt-1 flex flex-col">
                    {month.weeks.map((week) => {
                      const date = new Date(week.isoDate + 'T00:00:00');
                      const label = getWeekLabel(date);
                      const m = week.meeting;
                      const isActive = m && activeMeetingId === m.id;
                      const isPast = date < getMondayOf(today);

                      if (m) {
                        return (
                          <button
                            key={week.isoDate}
                            onClick={() => setActiveMeetingId(m.id)}
                            className={`w-full text-left px-4 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors ${
                              isActive ? 'bg-yellow-200 dark:bg-yellow-800/50 border-yellow-300 font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      }

                      // Empty week — clickable placeholder.
                      // Past weeks are only clickable when allowPast (weekend historical entry).
                      const blocked = isPast && !allowPast;
                      return (
                        <button
                          key={week.isoDate}
                          onClick={() => onNewMeeting(week.isoDate)}
                          disabled={isCreating || blocked}
                          className={`w-full text-left px-4 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors flex items-center justify-between group ${
                            blocked
                              ? 'text-gray-300 cursor-not-allowed'
                              : isPast
                                ? 'text-gray-400 dark:text-gray-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 dark:bg-amber-950/30 dark:hover:bg-amber-950/30 hover:text-amber-600 cursor-pointer italic'
                                : 'text-gray-400 dark:text-gray-300 hover:bg-sky-50 dark:hover:bg-sky-950/30 dark:bg-sky-950/30 dark:hover:bg-sky-950/30 hover:text-sky-600 cursor-pointer'
                          }`}
                          title={blocked ? t('sidebar.pastWeek') : `${t('sidebar.createWeekFor')} ${label}`}
                        >
                          <span className="italic">{label}</span>
                          {!blocked && <Plus size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add Meeting Button (next available week) */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onNewMeeting()}
            disabled={isCreating}
            className="w-full py-1.5 bg-green-500 hover:bg-green-600 text-white font-medium rounded shadow-sm text-xs disabled:opacity-50"
          >
            {isCreating ? t('sidebar.creating') : t('sidebar.newWeek')}
          </button>
        </div>
      </div>
    </div>
  );
}
