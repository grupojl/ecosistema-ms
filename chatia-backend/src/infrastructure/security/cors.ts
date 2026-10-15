// src/infrastructure/security/cors.ts
//
// CORS por ruta:
//  - /api/v1/widget/*  → público, cualquier origen, SIN credenciales (se incrusta en sitios de terceros;
//    la protección es el token de sesión firmado + límites, no el origen).
//  - resto             → solo ALLOWED_ORIGINS, con credenciales.
export interface CorsDecision {
  origin: boolean | string[];
  credentials: boolean;
}

export const WIDGET_PATH_PREFIX = '/api/v1/widget/';

export function parseAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function corsFor(path: string, allowedOrigins: string[]): CorsDecision {
  if (path.startsWith(WIDGET_PATH_PREFIX))
    return { origin: true, credentials: false };
  return { origin: allowedOrigins, credentials: true };
}
