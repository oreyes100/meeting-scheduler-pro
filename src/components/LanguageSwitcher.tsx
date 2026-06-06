'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLocale } from '@/lib/i18n';
import { Globe, Check } from 'lucide-react';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-sm text-gray-700 hover:text-sky-600 transition-colors"
        aria-label={t('lang.label')}
        title={t('lang.label')}
      >
        <Globe size={14} />
        <span className="text-xs">{locale === 'es' ? 'Español' : 'English'}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded shadow-lg z-50 overflow-hidden">
          <button
            onClick={() => { setLocale('en'); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 flex items-center justify-between ${locale === 'en' ? 'bg-sky-50 text-sky-700' : 'text-gray-700'}`}
          >
            <span>English</span>
            {locale === 'en' && <Check size={14} />}
          </button>
          <button
            onClick={() => { setLocale('es'); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 flex items-center justify-between ${locale === 'es' ? 'bg-sky-50 text-sky-700' : 'text-gray-700'}`}
          >
            <span>Español</span>
            {locale === 'es' && <Check size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
