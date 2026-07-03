import { NextResponse } from 'next/server';
import { sb } from '@/lib/crud';

// Traduce un identificador de login (correo real o nombre de usuario) al
// correo de autenticación (auth_email) que Supabase Auth reconoce.
export async function POST(request: Request) {
  try {
    const { identifier } = await request.json();
    if (!identifier) return NextResponse.json({ error: 'identifier required' }, { status: 400 });
    const id = String(identifier).trim();

    // Ya es un correo: probamos tal cual (puede ser el auth_email real o sintético).
    if (id.includes('@')) return NextResponse.json({ email: id.toLowerCase() });

    // Es un nombre de usuario: buscar su auth_email vinculado.
    const { data, error } = await sb()
      .from('users')
      .select('auth_email')
      .eq('username', id.toLowerCase())
      .limit(1);
    if (error) throw error;
    if (!data?.[0]?.auth_email) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json({ email: data[0].auth_email });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
