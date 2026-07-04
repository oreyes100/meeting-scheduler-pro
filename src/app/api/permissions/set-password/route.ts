import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';

// Cambia la contraseña de acceso de un publicador (admin) buscando su
// cuenta de Auth por auth_email y actualizándola vía Admin API.
export async function POST(request: Request) {
  try {
    const { user_id, password } = await request.json();
    if (!user_id || !password) return NextResponse.json({ error: 'user_id y password son requeridos' }, { status: 400 });
    if (String(password).length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });

    const supabase = sb();
    const { data: rows, error: rowErr } = await supabase.from('users').select('auth_email').eq('id', user_id).limit(1);
    if (rowErr) throw rowErr;
    const authEmail = rows?.[0]?.auth_email;
    if (!authEmail) return NextResponse.json({ error: 'Este publicador no tiene cuenta de acceso vinculada' }, { status: 400 });

    // Buscar el usuario de Auth por correo (Admin API no filtra por email de forma directa y confiable en todas las versiones).
    let authUserId: string | null = null;
    for (let page = 1; page <= 20 && !authUserId; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const found = data.users.find(u => u.email?.toLowerCase() === String(authEmail).toLowerCase());
      if (found) authUserId = found.id;
      if (data.users.length < 200) break;
    }
    if (!authUserId) return NextResponse.json({ error: 'Cuenta de Auth no encontrada' }, { status: 404 });

    const { error: updateErr } = await supabase.auth.admin.updateUserById(authUserId, { password });
    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
