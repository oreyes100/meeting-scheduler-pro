import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionContext } from '@/lib/serverContext';

function unauthorized() {
  return NextResponse.json({ error: 'Super-admin required' }, { status: 403 });
}

/**
 * POST /api/super-admin/provision
 * Creates a congregation + its first admin user in one atomic operation.
 *
 * Body:
 *   congregation_name  string  required
 *   congregation_city  string  optional
 *   enabled_modules    string[] optional (defaults to all)
 *   admin_first_name   string  required
 *   admin_last_name    string  optional
 *   admin_email        string  required  — used for Supabase Auth login
 *   admin_password     string  required  (min 8 chars)
 *   admin_username     string  optional  — shorthand login alias
 *
 * Returns: { congregation, user, credentials }
 * credentials.password is returned ONCE — store it before closing.
 */
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.isSuperAdmin) return unauthorized();

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const {
    congregation_name,
    congregation_city,
    enabled_modules,
    admin_first_name,
    admin_last_name,
    admin_email,
    admin_password,
    admin_username,
  } = body;

  if (!congregation_name?.trim()) return NextResponse.json({ error: 'congregation_name required' }, { status: 400 });
  if (!admin_first_name?.trim()) return NextResponse.json({ error: 'admin_first_name required' }, { status: 400 });
  if (!admin_email?.trim()) return NextResponse.json({ error: 'admin_email required' }, { status: 400 });
  if (!admin_password || admin_password.length < 8) return NextResponse.json({ error: 'admin_password must be ≥ 8 characters' }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });

  // Admin client uses service_role key — needed for auth.admin.createUser
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1. Create congregation
  const { data: congre, error: cErr } = await adminClient
    .from('congregations')
    .insert({ name: congregation_name.trim(), city: congregation_city?.trim() || null, enabled: true, enabled_modules: enabled_modules ?? null })
    .select().single();
  if (cErr) return NextResponse.json({ error: `Error creating congregation: ${cErr.message}` }, { status: 500 });

  // 2. Create Supabase Auth user
  const email = admin_email.trim().toLowerCase();
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email,
    password: admin_password,
    email_confirm: true,   // skip email confirmation flow
  });
  if (authErr) {
    // Roll back congregation on auth failure
    await adminClient.from('congregations').delete().eq('id', congre.id);
    return NextResponse.json({ error: `Error creating auth user: ${authErr.message}` }, { status: 500 });
  }

  // 3. Create users table row
  const displayName = [admin_first_name.trim(), admin_last_name?.trim()].filter(Boolean).join(' ');
  const { data: userRow, error: uErr } = await adminClient
    .from('users')
    .insert({
      first_name: admin_first_name.trim(),
      last_name: admin_last_name?.trim() || null,
      name: displayName,
      display_name: displayName,
      email: email,
      email1: email,
      auth_email: email,
      username: admin_username?.trim().toLowerCase() || null,
      app_role: 'admin',
      permissions: [],
      congregation_id: congre.id,
      is_active: true,
      is_publisher: false,
      status: 'active',
    })
    .select().single();

  if (uErr) {
    // Roll back auth user and congregation on users table failure
    await adminClient.auth.admin.deleteUser(authData.user!.id);
    await adminClient.from('congregations').delete().eq('id', congre.id);
    return NextResponse.json({ error: `Error creating user record: ${uErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    congregation: { id: congre.id, name: congre.name, city: congre.city },
    user: {
      id: userRow.id,
      name: displayName,
      email,
      username: userRow.username || null,
    },
    credentials: {
      login_identifier: userRow.username || email,
      password: admin_password,
      login_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://meeting-scheduler-pro.vercel.app'}/login`,
    },
  });
}
