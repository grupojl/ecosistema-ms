// src/internal/internal-api-key.guard.ts
//
// Guard que protege /api/v1/internal/* — solo servicios internos del ecosistema.
// Valida el header x-api-key contra CHAT_INTERNAL_API_KEY en .env.
//
// No usa Firebase ni TenantGuard — es una clave compartida entre microservicios.
// Si en el futuro necesitás claves por servicio, reemplazá este guard sin
// tocar los controllers.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req     = ctx.switchToHttp().getRequest();
    // Contrato superadmin: x-internal-api-key + INTERNAL_API_KEY (igual en todos los MS).
    // Legacy: x-api-key + CHAT_INTERNAL_API_KEY — se mantiene para no romper consumidores existentes.
    const headers = req.headers as Record<string, string | undefined>;
    const candidates: Array<[string | undefined, string | undefined]> = [
      [headers['x-internal-api-key'], this.config.get<string>('INTERNAL_API_KEY')],
      [headers['x-api-key'],          this.config.get<string>('CHAT_INTERNAL_API_KEY')],
    ];

    if (!candidates.some(([, expected]) => expected)) {
      this.logger.error('INTERNAL_API_KEY / CHAT_INTERNAL_API_KEY no configurada en .env');
      throw new ForbiddenException('Servicio no configurado para acceso interno');
    }

    const ok = candidates.some(([received, expected]) => !!received && !!expected && received === expected);
    if (!ok) {
      this.logger.warn(`API key interna inválida desde ${req.ip}`);
      throw new ForbiddenException('API key interna inválida o ausente');
    }

    return true;
  }
}
