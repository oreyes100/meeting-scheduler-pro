'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';

interface Props {
  /** true = hay cambios locales sin guardar en DB */
  pending?: boolean;
  /** fuerza el guardado; se llama al hacer clic si hay pending */
  onSync?: () => Promise<void> | void;
  /** posición fija en pantalla (default top-right) */
  className?: string;
}

type Conn = 'checking' | 'online' | 'offline';

const CHECK_INTERVAL = 20000;

export function SyncStatus({ pending = false, onSync, className }: Props) {
  const [conn, setConn] = useState<Conn>('checking');
  const [syncing, setSyncing] = useState(false);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      if (mounted.current) setConn(res.ok ? 'online' : 'offline');
    } catch {
      if (mounted.current) setConn('offline');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    check();
    const id = setInterval(check, CHECK_INTERVAL);
    const onOnline = () => check();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', () => setConn('offline'));
    return () => {
      mounted.current = false;
      clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, [check]);

  // Verde solo si conectado Y sin cambios pendientes
  const ok = conn === 'online' && !pending;

  const handleClick = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      if (pending && onSync) await onSync();
      await check();
    } finally {
      if (mounted.current) setSyncing(false);
    }
  };

  let label: string;
  let Icon = Cloud;
  if (syncing || conn === 'checking') { label = 'Sincronizando…'; Icon = RefreshCw; }
  else if (conn === 'offline') { label = 'Sin conexión'; Icon = CloudOff; }
  else if (pending) { label = 'Cambios sin guardar'; Icon = Cloud; }
  else { label = 'Sincronizado'; Icon = Check; }

  const green = ok && !syncing;
  const spinning = syncing || conn === 'checking';

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      className={`fixed z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg border transition-colors ${
        green
          ? 'bg-green-600 border-green-500 text-white hover:bg-green-700'
          : 'bg-red-600 border-red-500 text-white hover:bg-red-700'
      } ${className || 'bottom-16 right-3 md:bottom-3'}`}
    >
      <Icon size={13} className={spinning ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
