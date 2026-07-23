import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/sqlite';
import { signSession, COOKIE_NAME, sessionCookieOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();
    if (!identifier || !password) {
      return NextResponse.json({ error: 'identifier y password requeridos' }, { status: 400 });
    }

    const id = String(identifier).trim().toLowerCase();
    const db = getDb();

    // Find user by email, auth_email, or username
    const row = db.prepare(`
      SELECT id, auth_email, email, congregation_id, is_super_admin, password_hash, disable_app_access
      FROM users
      WHERE lower(auth_email) = ? OR lower(email) = ? OR lower(username) = ?
      LIMIT 1
    `).get(id, id, id) as {
      id: string;
      auth_email: string | null;
      email: string;
      congregation_id: string | null;
      is_super_admin: number;
      password_hash: string | null;
      disable_app_access: number;
    } | undefined;

    if (!row) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 401 });
    if (row.disable_app_access) return NextResponse.json({ error: 'Acceso deshabilitado' }, { status: 403 });
    if (!row.password_hash) return NextResponse.json({ error: 'Cuenta sin contraseña configurada' }, { status: 401 });

    const valid = await bcrypt.compare(String(password), row.password_hash);
    if (!valid) return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });

    const token = await signSession(row.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token, sessionCookieOptions());
    return res;
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
