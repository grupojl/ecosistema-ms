// src/infrastructure/common/services/tenant-auth.service.ts
//
// Autenticación de tenant compartida por TenantGuard (HTTP) y EventsGateway (WebSocket).
// Antes la lógica vivía solo en el guard y el gateway no autenticaba: cualquiera podía unirse a
// `org:<id>` y leer mensajes de otro tenant.
//
// Flujo:
//   1. Verificar el Bearer token con Firebase Admin
//   2. Resolver el Ecosystem por firebaseProjectId (campo `aud`)
//   3. Validar custom claims con Zod
//   4. Verificar claims.organizationId === organización pedida
//   5. Verificar permissions.chat.canRead
//   6. Upsert pasivo de Organization + Agent
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FirebaseService } from '@/infrastructure/firebase/firebase.service.js';
import { EcosystemService } from '@/core/ecosystem/ecosystem.service.js';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { TenantClaimsSchema } from '@/infrastructure/common/schemas/tenant-claims.schema.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';

const PRODUCT_KEY = 'chat';

/** Lo mínimo que usamos del token de Firebase (el resto se valida con Zod en TenantClaimsSchema). */
interface FirebaseTokenClaims {
  uid: string;
  aud: string | string[];
  email?: string;
  name?: string;
}

export interface TenantAuthInput {
  /** Valor del header Authorization (`Bearer <token>`). */
  authorization?: string;
  organizationId?: string;
  marketCountry?: string;
}

@Injectable()
export class TenantAuthService {
  private readonly logger = new Logger(TenantAuthService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly ecosystem: EcosystemService,
    private readonly prisma: PrismaService,
  ) {}

  /** Bypass de desarrollo SOLO con ALLOW_DEV_AUTH=true explícito y fuera de producción. */
  get devAuthAllowed(): boolean {
    return (
      process.env['NODE_ENV'] !== 'production' &&
      process.env['ALLOW_DEV_AUTH'] === 'true'
    );
  }

  async authenticate(input: TenantAuthInput): Promise<TenantContext> {
    const { authorization, organizationId: orgHeader } = input;
    const marketCountry = input.marketCountry
      ? input.marketCountry.toUpperCase()
      : undefined;
    const isDev = this.devAuthAllowed;

    // ── Modo desarrollo: Firebase no configurado ──────────────────────────────
    if (!this.firebase.isInitialized) {
      if (!isDev) {
        throw new UnauthorizedException('Firebase no configurado');
      }
      if (!orgHeader) {
        throw new UnauthorizedException(
          'x-organization-id requerido (modo dev)',
        );
      }
      this.logger.warn(`[DEV] Sin Firebase — org: ${orgHeader}`);
      return this.devTenant(orgHeader, marketCountry);
    }

    // ── Sin Bearer token (fallback dev) ───────────────────────────────────────
    if (!authorization?.startsWith('Bearer ')) {
      if (isDev && orgHeader) {
        this.logger.warn('[DEV] Sin Bearer token — usando x-organization-id');
        return this.devTenant(orgHeader, marketCountry);
      }
      throw new UnauthorizedException('Authorization Bearer requerido');
    }

    const token = authorization.slice(7);

    // ── 1. Verificar token Firebase ───────────────────────────────────────────
    let decoded: FirebaseTokenClaims;
    try {
      decoded = await this.firebase.verifyIdToken(token);
    } catch {
      throw new UnauthorizedException('Token Firebase inválido o expirado');
    }

    // ── 2. Resolver Ecosystem por firebaseProjectId ───────────────────────────
    // El campo 'aud' del token es el firebaseProjectId del ecosistema emisor
    const firebaseProjectId = Array.isArray(decoded.aud)
      ? decoded.aud[0]
      : decoded.aud;
    const ecosystemRecord =
      await this.ecosystem.resolveByFirebaseProjectId(firebaseProjectId);

    if (!ecosystemRecord) {
      this.logger.warn(`Ecosistema no registrado: ${firebaseProjectId}`);
      throw new ForbiddenException(
        `Ecosistema no autorizado. Registralo en POST /api/v1/ecosystems.`,
      );
    }
    if (!ecosystemRecord.isActive) {
      throw new ForbiddenException('Ecosistema desactivado');
    }

    // ── 3. Validar custom claims con Zod ──────────────────────────────────────
    const claimsResult = TenantClaimsSchema.safeParse(decoded);
    if (!claimsResult.success) {
      this.logger.warn(
        `Claims inválidos para uid ${decoded.uid}: ${claimsResult.error.message}`,
      );
      throw new ForbiddenException(
        'Token sin claims requeridos. El sass-back debe emitir organizationId, role y permissions.',
      );
    }
    const claims = claimsResult.data;

    // ── 4. Verificar organizationId pedido ────────────────────────────────────
    if (!orgHeader) {
      throw new UnauthorizedException('Header x-organization-id requerido');
    }
    if (claims.organizationId !== orgHeader) {
      throw new ForbiddenException(
        `organizationId del token (${claims.organizationId}) no coincide con el header (${orgHeader})`,
      );
    }

    // ── 5. Verificar permissions.chat.canRead ─────────────────────────────────
    const chatPerms = claims.permissions?.[PRODUCT_KEY];
    if (!chatPerms?.canRead) {
      throw new ForbiddenException(
        `Sin acceso al módulo "${PRODUCT_KEY}" en esta organización`,
      );
    }

    // ── 6. Upsert pasivo de Organization y Agent ──────────────────────────────
    await this.ecosystem.ensureOrganization(
      ecosystemRecord.id,
      claims.organizationId,
      claims.organizationName,
      claims.organizationSlug,
    );

    // El uid de Firebase es único por proyecto, pero un ecosistema puede elegir cualquier uid al emitir tokens:
    // si ya existe un agente con ese uid en OTRO ecosistema, no se lo toca ni se lo devuelve.
    const existingAgent = await this.prisma.agent.findUnique({
      where: { firebaseUid: decoded.uid },
      select: { organization: { select: { ecosystemId: true } } },
    });
    if (
      existingAgent &&
      existingAgent.organization.ecosystemId !== ecosystemRecord.id
    ) {
      this.logger.error(
        `[SEGURIDAD] uid ${decoded.uid} del ecosistema ${ecosystemRecord.id} colisiona con un agente de otro ecosistema`,
      );
      throw new ForbiddenException('Agente asociado a otro ecosistema');
    }

    const agent = await this.prisma.agent.upsert({
      where: { firebaseUid: decoded.uid },
      update: {
        name: decoded.name ?? decoded.email ?? decoded.uid,
        email: decoded.email ?? `${decoded.uid}@unknown`,
        role: claims.role,
      },
      create: {
        firebaseUid: decoded.uid,
        organizationId: claims.organizationId,
        name: decoded.name ?? decoded.email ?? decoded.uid,
        email: decoded.email ?? `${decoded.uid}@unknown`,
        role: claims.role,
      },
    });

    return {
      ecosystemId: ecosystemRecord.id,
      organizationId: claims.organizationId,
      organizationName: claims.organizationName,
      firebaseUid: decoded.uid,
      email: decoded.email ?? '',
      name: decoded.name ?? decoded.email ?? decoded.uid,
      role: claims.role,
      canRead: chatPerms.canRead,
      canWrite: chatPerms.canWrite,
      agentId: agent.id,
      marketCountry,
    } satisfies TenantContext;
  }

  private devTenant(
    organizationId: string,
    marketCountry?: string,
  ): TenantContext {
    return {
      ecosystemId: 'dev',
      organizationId,
      organizationName: 'Dev Organization',
      firebaseUid: 'dev-uid',
      email: 'dev@localhost',
      name: 'Dev User',
      role: 'ADMIN',
      canRead: true,
      canWrite: true,
      marketCountry,
    } satisfies TenantContext;
  }
}
