import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cliente de navegador basado en cookies: comparte sesión con el middleware
// (src/proxy.ts usa createServerClient de @supabase/ssr, que lee cookies, no localStorage).
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
