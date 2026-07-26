import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated, canAccessCuentas } from '@/lib/serverContext';

/**
 * Guard único de todos los endpoints de Cuentas.
 *
 * Devuelve `{ congreId }` cuando el acceso procede, o una `NextResponse` de
 * error. Centralizarlo evita que un handler nuevo olvide el filtro de
 * congregación, que es el único mecanismo de aislamiento entre congregaciones.
 */
export async function requireCuentas(): Promise<
  { ok: true; congreId: string; userId: string } | { ok: false; res: NextResponse }
> {
  const ctx = await getSessionContext();
  if (!ctx.userId) return { ok: false, res: unauthenticated() };
  if (!ctx.congreId) {
    return { ok: false, res: NextResponse.json({ error: 'Cuenta sin congregación asignada' }, { status: 403 }) };
  }
  if (!canAccessCuentas(ctx)) {
    return { ok: false, res: NextResponse.json({ error: 'Sin acceso al módulo Cuentas' }, { status: 403 }) };
  }
  return { ok: true, congreId: ctx.congreId, userId: ctx.userId };
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(e: unknown) {
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
}
