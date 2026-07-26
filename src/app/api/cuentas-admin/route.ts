import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';

// Server-side: usa URL interna para evitar salir al exterior cuando Cuentas corre en el mismo VPS.
const CUENTAS_URL = process.env.CUENTAS_INTERNAL_URL || 'https://cuentas-congregacion-bay.vercel.app';

async function proxyMaster(action: string, body: Record<string, unknown> = {}) {
  const secret = process.env.CUENTAS_MASTER_SECRET;
  if (!secret) throw new Error('CUENTAS_MASTER_SECRET no configurada en el servidor');
  const res = await fetch(`${CUENTAS_URL}/api/master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-master-secret': secret },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Solo superadmin' }, { status: 403 });
  try {
    const data = await proxyMaster('list_users');
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx.userId) return unauthenticated();
  if (!ctx.isSuperAdmin) return NextResponse.json({ error: 'Solo superadmin' }, { status: 403 });
  try {
    const body = await request.json();
    const { action, username, password, role } = body;
    if (!['reset_password', 'create_user', 'delete_user'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }
    const data = await proxyMaster(action, { username, password, role });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
