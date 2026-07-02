import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { sb } from '@/lib/crud';

// Devuelve rol/permisos del usuario autenticado, vinculando auth email ↔ users
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supaAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
    );
    const { data: { user } } = await supaAuth.auth.getUser();
    if (!user?.email) return NextResponse.json({ authenticated: false });

    const supabase = sb();
    const email = user.email.toLowerCase();
    const { data: rows } = await supabase
      .from('users')
      .select('id, name, first_name, last_name, app_role, permissions, auth_email, email1')
      .or(`auth_email.eq.${email},email1.eq.${email}`)
      .limit(1);

    const row = rows?.[0] || null;
    return NextResponse.json({
      authenticated: true,
      email,
      user_id: row?.id || null,
      name: row?.name || [row?.first_name, row?.last_name].filter(Boolean).join(' ') || email,
      app_role: row?.app_role || 'admin', // sin fila vinculada = admin (cuenta de gestión)
      permissions: Array.isArray(row?.permissions) ? row.permissions : [],
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
