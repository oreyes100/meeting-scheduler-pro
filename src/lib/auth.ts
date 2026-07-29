import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'msp_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export { COOKIE_NAME };

// Lazy — se evalúa en la primera llamada real, no al cargar el módulo.
// Esto evita que el throw rompa el build de Next.js durante el análisis estático
// de rutas, mientras que sigue siendo fail-fast en runtime.
let _secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (!_secret) {
    const raw = process.env.AUTH_SECRET;
    if (!raw || raw.length < 32) {
      throw new Error(
        'AUTH_SECRET ausente o menor de 32 caracteres. ' +
        'Configúralo en el entorno de producción; no hay secreto por defecto.'
      );
    }
    _secret = new TextEncoder().encode(raw);
  }
  return _secret;
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE,
  };
}
