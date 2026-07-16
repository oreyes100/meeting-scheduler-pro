import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { sb } from './crud';

export interface SessionContext {
  userId: string | null;
  congreId: string | null;
  isSuperAdmin: boolean;
  email: string | null;
}

/** Resolve congregation_id + super-admin flag for the current request. */
export async function getSessionContext(): Promise<SessionContext> {
  const cookieStore = await cookies();
  const supaAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
  );
  const { data: { user } } = await supaAuth.auth.getUser();
  if (!user?.email) return { userId: null, congreId: null, isSuperAdmin: false, email: null };

  const email = user.email.toLowerCase();

  // Env-var super-admin list works before AND after migration
  const envAdmins = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const envIsSuperAdmin = envAdmins.includes(email);

  // Try post-migration columns; fall back gracefully if they don't exist yet
  const { data, error } = await sb()
    .from('users')
    .select('id, congregation_id, is_super_admin')
    .or(`auth_email.eq.${email},email1.eq.${email}`)
    .limit(1);

  if (error) {
    // Columns not yet migrated — id-only fallback
    const { data: fb } = await sb()
      .from('users')
      .select('id')
      .or(`auth_email.eq.${email},email1.eq.${email}`)
      .limit(1);
    return { userId: fb?.[0]?.id ?? null, congreId: null, isSuperAdmin: envIsSuperAdmin, email };
  }

  const row = data?.[0];
  return {
    userId: row?.id ?? null,
    congreId: row?.congregation_id ?? null,
    isSuperAdmin: envIsSuperAdmin || !!row?.is_super_admin,
    email,
  };
}
