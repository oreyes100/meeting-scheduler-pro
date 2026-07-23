import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/serverContext';
import { getDb } from '@/lib/sqlite';

export async function GET() {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ authenticated: false });

    const db = getDb();
    const row = db.prepare(`
      SELECT id, name, first_name, last_name, app_role, permissions, auth_email,
             is_regular_pioneer, is_special_pioneer, is_auxiliary_pioneer,
             congregation_id, is_super_admin
      FROM users WHERE id = ? LIMIT 1
    `).get(ctx.userId) as {
      id: string; name: string; first_name: string | null; last_name: string | null;
      app_role: string | null; permissions: string | null; auth_email: string | null;
      is_regular_pioneer: number; is_special_pioneer: number; is_auxiliary_pioneer: number;
      congregation_id: string | null; is_super_admin: number;
    } | undefined;

    if (!row) return NextResponse.json({ authenticated: false });

    type CongreRow = { name: string; city: string | null; enabled_modules: string | null };
    let congre: CongreRow | null = null;
    if (row.congregation_id) {
      congre = (db.prepare(`SELECT name, city, enabled_modules FROM congregations WHERE id = ? LIMIT 1`)
        .get(row.congregation_id) as CongreRow | undefined) ?? null;
    }

    let permissions: string[] = [];
    try { permissions = JSON.parse(row.permissions ?? '[]'); } catch { permissions = []; }
    let enabledModules: string[] | null = null;
    try { enabledModules = congre?.enabled_modules ? JSON.parse(congre.enabled_modules) : null; } catch { enabledModules = null; }

    return NextResponse.json({
      authenticated: true,
      email: row.auth_email?.toLowerCase() ?? ctx.email,
      user_id: row.id,
      name: row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || ctx.email,
      app_role: row.app_role || 'admin',
      permissions: Array.isArray(permissions) ? permissions : [],
      is_regular_pioneer: !!row.is_regular_pioneer,
      is_special_pioneer: !!row.is_special_pioneer,
      is_auxiliary_pioneer: !!row.is_auxiliary_pioneer,
      congregation_id: row.congregation_id || null,
      congregation_name: congre?.name || null,
      congregation_city: congre?.city || null,
      enabled_modules: enabledModules,
      is_super_admin: ctx.isSuperAdmin,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
