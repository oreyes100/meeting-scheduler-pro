import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';
import { getDb } from '@/lib/sqlite';

export async function GET(request: Request) {
  const diag = new URL(request.url).searchParams.get('diag') === '1';

  try {
    const supabase = sb();
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;

    if (!diag) return NextResponse.json({ ok: true });

    // Diagnóstico solo en desarrollo: informa qué archivo de base tiene abierto
    // el proceso. Sin esto no hay forma de distinguir «la consulta no encuentra
    // al usuario» de «el servidor está leyendo otra base».
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ ok: true, diag: 'no disponible en producción' });
    }

    const db = getDb();
    const files = (db.prepare('PRAGMA database_list').all() as { name: string; file: string }[])
      .map(r => ({ name: r.name, file: r.file }));

    const counts = {
      users: (db.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n,
      congregations: (db.prepare('SELECT COUNT(*) n FROM congregations').get() as { n: number }).n,
      cuentas_transactions: (() => {
        try { return (db.prepare('SELECT COUNT(*) n FROM cuentas_transactions').get() as { n: number }).n; }
        catch { return 'tabla ausente'; }
      })(),
      cuentas_codes: (() => {
        try { return (db.prepare('SELECT COUNT(*) n FROM cuentas_codes').get() as { n: number }).n; }
        catch { return 'tabla ausente'; }
      })(),
    };

    // Presencia de cuentas con acceso, sin exponer datos personales.
    const admins = (db.prepare(
      `SELECT auth_email FROM users WHERE is_super_admin = 1 OR app_role = 'admin' LIMIT 5`
    ).all() as { auth_email: string | null }[]).map(r => r.auth_email ?? '(sin correo)');

    return NextResponse.json({
      ok: true,
      cwd: process.cwd(),
      DB_PATH_env: process.env.DB_PATH ?? '(sin definir)',
      databaseFiles: files,
      counts,
      adminAccounts: admins,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'error' },
      { status: 503 },
    );
  }
}
