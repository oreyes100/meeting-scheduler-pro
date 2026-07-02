'use client';

import { useEffect, useState } from 'react';

export interface Me {
  authenticated: boolean;
  email?: string;
  user_id?: string | null;
  name?: string;
  app_role: 'admin' | 'elder' | 'publisher';
  permissions: string[];
}

let cache: Me | null = null;
let inflight: Promise<Me> | null = null;

async function fetchMe(): Promise<Me> {
  const res = await fetch('/api/me', { cache: 'no-store' });
  const data = await res.json();
  return {
    authenticated: !!data.authenticated,
    email: data.email,
    user_id: data.user_id,
    name: data.name,
    app_role: data.app_role || 'publisher',
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
}

export function useMe(): { me: Me | null; loading: boolean } {
  const [me, setMe] = useState<Me | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    if (!inflight) inflight = fetchMe();
    inflight.then((m) => { cache = m; setMe(m); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return { me, loading };
}

/** ¿Puede usar el módulo? admin/elder ven todo; publisher según permissions */
export function canAccess(me: Me | null, moduleKey: string, adminOnly?: boolean): boolean {
  if (!me) return true; // aún cargando — no bloquear render, gate lo maneja
  if (adminOnly) return me.app_role === 'admin';
  if (me.app_role === 'admin' || me.app_role === 'elder') return true;
  if (moduleKey === 'my-report') return true; // todo publicador puede subir su informe
  return me.permissions.includes(moduleKey);
}
