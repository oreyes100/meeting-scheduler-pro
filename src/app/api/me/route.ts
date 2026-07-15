import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { sb } from '@/lib/crud';

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

    const email = user.email.toLowerCase();
    const { data: rows } = await sb()
      .from('users')
      .select(`
        id, name, first_name, last_name, app_role, permissions, auth_email, email1,
        is_regular_pioneer, is_special_pioneer, is_auxiliary_pioneer,
        congregation_id, is_super_admin,
        congregations ( name, city, enabled_modules )
      `)
      .or(`auth_email.eq.${email},email1.eq.${email}`)
      .limit(1);

    const row = rows?.[0] as any || null;
    const congre = row?.congregations ?? null;

    return NextResponse.json({
      authenticated: true,
      email,
      user_id: row?.id || null,
      name: row?.name || [row?.first_name, row?.last_name].filter(Boolean).join(' ') || email,
      app_role: row?.app_role || 'admin',
      permissions: Array.isArray(row?.permissions) ? row.permissions : [],
      is_regular_pioneer: !!row?.is_regular_pioneer,
      is_special_pioneer: !!row?.is_special_pioneer,
      is_auxiliary_pioneer: !!row?.is_auxiliary_pioneer,
      congregation_id: row?.congregation_id || null,
      congregation_name: congre?.name || null,
      congregation_city: congre?.city || null,
      enabled_modules: Array.isArray(congre?.enabled_modules) ? congre.enabled_modules : null,
      is_super_admin: !!row?.is_super_admin,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
