// src/infrastructure/common/guards/tenant.guard.ts
//
// ADR-001 Sprint 2 — TenantGuard: autentica el request y puebla `request.tenant`.
// La lógica vive en TenantAuthService (compartida con el gateway de WebSocket).
// Ver ese servicio para el flujo completo de verificación Firebase + claims + organización.
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';
import { TenantAuthService } from '@/infrastructure/common/services/tenant-auth.service.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly auth: TenantAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { tenant?: TenantContext }>();
    const headers = request.headers as Record<string, string | undefined>;

    request.tenant = await this.auth.authenticate({
      authorization: headers['authorization'],
      organizationId: headers['x-organization-id'],
      marketCountry: headers['x-market-country'],
    });
    return true;
  }
}
