'use client';

import { useEffect } from 'react';
import { useLocale } from '@/lib/i18n';

export function LocaleLang() {
  const { locale } = useLocale();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);
  return null;
}
