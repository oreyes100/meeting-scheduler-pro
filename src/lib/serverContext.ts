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
  const { data } = await sb()
    .from('users')
    .select('id, congregation_id, is_super_admin')
    .or(`auth_email.eq.${email},email1.eq.${email}`)
    .limit(1);

  const row = data?.[0];
  return {
    userId: row?.id ?? null,
    congreId: row?.congregation_id ?? null,
    isSuperAdmin: !!row?.is_super_admin,
    email,
  };
}
