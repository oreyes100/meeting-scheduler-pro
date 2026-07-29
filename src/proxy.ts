import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { COOKIE_NAME } from '@/lib/auth';

// Rutas de API sin sesión: auth pública, health, y webhooks con su propio secreto.
const PUBLIC_API_PREFIXES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/resolve-login',
  '/api/cuentas/telegram',     // autenticada con X-Telegram-Bot-Api-Secret-Token
  '/api/cuentas/ocr/internal', // autenticada con x-internal-secret
];

let _secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (!_secret) {
    const raw = process.env.AUTH_SECRET;
    if (!raw || raw.length < 32) throw new Error('AUTH_SECRET ausente o < 32 chars');
    _secret = new TextEncoder().encode(raw);
  }
  return _secret;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    // Rutas públicas — pasan sin verificar cookie
    if (PUBLIC_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return NextResponse.next();
    }
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    try {
      await jwtVerify(token, getSecret());
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
    }
  }

  // Rutas de página: redirigir a /login si no hay sesión válida
  if (pathname.startsWith('/login')) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      await jwtVerify(token, getSecret());
      return NextResponse.next();
    } catch { /* sesión inválida — redirigir */ }
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
