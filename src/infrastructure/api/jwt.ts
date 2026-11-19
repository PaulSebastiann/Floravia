/**
 * Lectura (NO verificacion) del payload de un JWT. La firma la verifica la API en cada peticion;
 * aqui solo se lee `exp`, `email` y `role` para decidir que mostrar. Nunca tomar decisiones de
 * seguridad con esto.
 */
export interface PayloadJwt {
  readonly exp?: number;
  readonly email?: string;
  readonly role?: string;
}

export function leerPayload(token: string): PayloadJwt | null {
  const partes = token.split('.');
  if (partes.length !== 3 || !partes[1]) return null;
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const o: unknown = JSON.parse(json);
    if (typeof o !== 'object' || o === null) return null;
    const r = o as Record<string, unknown>;
    const pick = (k: string): string | undefined => (typeof r[k] === 'string' ? (r[k] as string) : undefined);
    return {
      exp: typeof r['exp'] === 'number' ? r['exp'] : undefined,
      email: pick('email') ?? pick('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'),
      role: pick('role') ?? pick('http://schemas.microsoft.com/ws/2008/06/identity/claims/role'),
    };
  } catch {
    return null;
  }
}

export const estaVigente = (p: PayloadJwt | null, ahoraMs = Date.now()): boolean =>
  p?.exp !== undefined && p.exp * 1000 > ahoraMs + 5_000;
