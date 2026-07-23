import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/sqlite';
import { getSessionContext } from '@/lib/serverContext';

export async function POST(request: Request) {
  try {
    const ctx = await getSessionContext();
    if (!ctx.userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { user_id, password } = await request.json();
    if (!user_id || !password) return NextResponse.json({ error: 'user_id y password requeridos' }, { status: 400 });
    if (String(password).length < 6) return NextResponse.json({ error: 'Mínimo 6 caracteres' }, { status: 400 });

    const hash = await bcrypt.hash(String(password), 10);
    const db = getDb();
    const info = db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, user_id);
    if (info.changes === 0) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
