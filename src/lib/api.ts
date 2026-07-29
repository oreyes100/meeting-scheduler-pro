import { NextResponse } from 'next/server';
import { getSessionContext, unauthenticated } from '@/lib/serverContext';
import type { SessionContext } from '@/lib/serverContext';

// HOF para rutas autenticadas. Captura excepciones → 500 estructurado.
// Para rutas dinámicas (con params) usa la variante withAuthParams.
export function withAuth(
  handler: (ctx: SessionContext, req: Request) => Promise<Response>
) {
  return async (req: Request) => {
    try {
      const ctx = await getSessionContext();
      if (!ctx.userId) return unauthenticated();
      return await handler(ctx, req);
    } catch (e) {
      return serverError(e);
    }
  };
}

// Variante para rutas dinámicas de Next.js que reciben un segundo argumento
// con los params de segmento (p.ej. [id]).
export function withAuthParams<P>(
  handler: (ctx: SessionContext, req: Request, ctx2: { params: Promise<P> }) => Promise<Response>
) {
  return async (req: Request, ctx2: { params: Promise<P> }) => {
    try {
      const ctx = await getSessionContext();
      if (!ctx.userId) return unauthenticated();
      return await handler(ctx, req, ctx2);
    } catch (e) {
      return serverError(e);
    }
  };
}

export function apiError(message: string, status = 400): Response {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(e: unknown): Response {
  const message = e instanceof Error ? e.message : 'Error interno del servidor';
  return NextResponse.json({ error: message }, { status: 500 });
}
