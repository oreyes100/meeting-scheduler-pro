import { NextResponse } from 'next/server';
import { getDb } from '@/lib/sqlite';
import { requireCuentas, serverError } from '../_guard';

/**
 * Encabezado de los formularios S-26 / S-30 / S-25c.
 * Por defecto se toma de `congregations` (name/city); `cuentas_config` permite
 * sobreescribirlo y aporta el `state`, que los formularios piden y MSP no guarda.
 */
export async function GET() {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const db = getDb();

    const congre = db.prepare(
      `SELECT name, city FROM congregations WHERE id = ?`
    ).get(g.congreId) as { name: string; city: string | null } | undefined;

    const cfg = db.prepare(
      `SELECT label, city, state FROM cuentas_config WHERE congregation_id = ?`
    ).get(g.congreId) as { label: string | null; city: string | null; state: string | null } | undefined;

    return NextResponse.json({
      config: {
        label: cfg?.label || congre?.name || '',
        city:  cfg?.city  || congre?.city || '',
        state: cfg?.state || '',
      },
    });
  } catch (e) { return serverError(e); }
}

export async function PUT(request: Request) {
  const g = await requireCuentas();
  if (!g.ok) return g.res;

  try {
    const { label, city, state } = await request.json();

    getDb().prepare(`
      INSERT INTO cuentas_config (congregation_id, label, city, state, updated_at)
      VALUES (?,?,?,?, datetime('now'))
      ON CONFLICT(congregation_id) DO UPDATE SET
        label = excluded.label, city = excluded.city,
        state = excluded.state, updated_at = datetime('now')
    `).run(
      g.congreId,
      label != null ? String(label).trim() : null,
      city  != null ? String(city).trim()  : null,
      state != null ? String(state).trim() : null,
    );

    return NextResponse.json({ success: true });
  } catch (e) { return serverError(e); }
}
