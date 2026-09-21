// Molde: workers-backend/src/internal/internal-api-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request }  from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req      = ctx.switchToHttp().getRequest<Request>();
    const key      = req.headers['x-internal-api-key'] as string | undefined;
    const expected = this.config.getOrThrow<string>('INTERNAL_API_KEY');
    if (!key || key !== expected) {
      this.logger.warn(`[InternalApiKeyGuard] Unauthorized from ${req.ip}`);
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}
