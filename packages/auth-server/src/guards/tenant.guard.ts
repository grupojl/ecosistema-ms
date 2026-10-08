// @ecosistema-ms/auth-server — TenantGuard (stateless)
//
// Para servicios que NO tienen registro local de ecosistemas (ej. marketing-backend).
// chatia-backend mantiene su propio guard porque resuelve el Ecosystem en DB.
//
// Flujo:
//   1. Bearer token → verificación con Firebase Admin SDK
//   2. Custom claims validados con Zod (TenantClaimsSchema) — los emite el sass-back
//   3. claims.organizationId === header x-organization-id
//   4. claims.permissions[<producto>].canRead (producto = env TENANT_PRODUCT_KEY)
//   5. request.tenant = TenantContext
//
// Dev (NODE_ENV != production) sin Firebase: acepta x-organization-id (+ x-ecosystem-id).
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'express';
import { TenantClaimsSchema } from '@/types/tenant-claims.js';
import type { TenantContext } from '@/types/tenant-context.js';

type TenantRequest = Request & { tenant?: TenantContext };

function firebaseApp(): App | null {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = process.env['FIREBASE_PROJECT_ID'];
  if (!projectId) return null;

  const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
  const privateKey  = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');
  return initializeApp({
    credential: clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault(),
    projectId,
  });
}

@Injectable()
export class TenantGuard implements CanActivate {
  private readonly logger = new Logger(TenantGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req           = context.switchToHttp().getRequest<TenantRequest>();
    const authHeader    = req.headers['authorization'];
    const orgHeader     = req.headers['x-organization-id'];
    const ecosystemHdr  = req.headers['x-ecosystem-id'];
    const marketHeader  = req.headers['x-market-country'];
    const marketCountry = typeof marketHeader === 'string' ? marketHeader.toUpperCase() : undefined;

    const isProd     = process.env['NODE_ENV'] === 'production';
    const productKey = process.env['TENANT_PRODUCT_KEY'] ?? 'marketing';
    const app        = firebaseApp();

    // ── Dev sin Firebase / sin Bearer ────────────────────────────────────────
    if (!app || !authHeader?.startsWith('Bearer ')) {
      if (isProd) throw new UnauthorizedException('Authorization Bearer requerido');
      if (typeof orgHeader !== 'string' || !orgHeader) {
        throw new UnauthorizedException('x-organization-id requerido (modo dev)');
      }
      this.logger.warn(`[DEV] Sin Firebase/Bearer — org: ${orgHeader}`);
      req.tenant = {
        ecosystemId:      typeof ecosystemHdr === 'string' && ecosystemHdr ? ecosystemHdr : 'dev',
        organizationId:   orgHeader,
        organizationName: 'Dev Organization',
        firebaseUid:      'dev-uid',
        email:            'dev@localhost',
        name:             'Dev User',
        role:             'ADMIN',
        canRead:          true,
        canWrite:         true,
        ...(marketCountry ? { marketCountry } : {}),
      };
      return true;
    }

    // ── 1. Token Firebase ────────────────────────────────────────────────────
    let decoded: DecodedIdToken;
    try {
      decoded = await getAuth(app).verifyIdToken(authHeader.slice(7));
    } catch {
      throw new UnauthorizedException('Token Firebase inválido o expirado');
    }

    // ── 2. Claims ────────────────────────────────────────────────────────────
    const parsed = TenantClaimsSchema.safeParse(decoded);
    if (!parsed.success) {
      this.logger.warn(`Claims inválidos para uid ${decoded.uid}: ${parsed.error.message}`);
      throw new ForbiddenException(
        'Token sin claims requeridos (ecosystemId, organizationId, role, permissions).',
      );
    }
    const claims = parsed.data;

    // ── 3. Header de organización ────────────────────────────────────────────
    if (typeof orgHeader !== 'string' || !orgHeader) {
      throw new UnauthorizedException('Header x-organization-id requerido');
    }
    if (claims.organizationId !== orgHeader) {
      throw new ForbiddenException('organizationId del token no coincide con el header');
    }

    // ── 4. Permiso de producto ───────────────────────────────────────────────
    const perms = claims.permissions?.[productKey];
    if (!perms?.canRead) {
      throw new ForbiddenException(`Sin acceso al módulo "${productKey}" en esta organización`);
    }

    // ── 5. TenantContext ─────────────────────────────────────────────────────
    req.tenant = {
      ecosystemId:      claims.ecosystemId,
      organizationId:   claims.organizationId,
      organizationName: claims.organizationName ?? claims.organizationId,
      firebaseUid:      decoded.uid,
      email:            decoded.email ?? '',
      name:             decoded.name ?? decoded.email ?? decoded.uid,
      role:             claims.role,
      canRead:          perms.canRead,
      canWrite:         perms.canWrite ?? false,
      ...(marketCountry ? { marketCountry } : {}),
    };
    return true;
  }
}
