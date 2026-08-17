// notificaciones-backend/src/health/health.controller.ts
//
// N-3.4: Health check extendido.
// GET /api/v1/health        — liveness
// GET /api/v1/health/ready  — readiness: DB + Redis + providers externos

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck, HealthCheckService, PrismaHealthIndicator, HealthCheckResult,
} from '@nestjs/terminus';
import { ConfigService }  from '@nestjs/config';
import { PrismaService }  from '../prisma/prisma.service.js';
import { Public }         from '@ecosistema-ms/auth-server';
import { ApiTags }        from '@nestjs/swagger';

@ApiTags('health')
@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly health:  HealthCheckService,
    private readonly prisma:  PrismaHealthIndicator,
    private readonly db:      PrismaService,
    private readonly config:  ConfigService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.pingCheck('database', this.db),
    ]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  async ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.pingCheck('database', this.db),
      // Meta API check — solo verifica conectividad, no gasta cuota
      async () => {
        const token   = this.config.get<string>('META_SYSTEM_TOKEN');
        const phoneId = this.config.get<string>('META_PHONE_NUMBER_ID');
        if (!token || !phoneId) {
          return { whatsapp: { status: 'up', message: 'not configured' } };
        }
        try {
          const res = await fetch(
            `https://graph.facebook.com/v21.0/${phoneId}?fields=id&access_token=${token}`,
            { signal: AbortSignal.timeout(3_000) },
          );
          return { whatsapp: { status: res.ok ? 'up' : 'down', httpStatus: res.status } };
        } catch {
          return { whatsapp: { status: 'down', message: 'unreachable' } };
        }
      },
      // Resend check
      async () => {
        const key = this.config.get<string>('RESEND_API_KEY');
        if (!key) return { resend: { status: 'up', message: 'not configured' } };
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ from: 'test@test.com', to: ['test@test.com'], subject: 'health', html: 'health' }),
            signal:  AbortSignal.timeout(3_000),
          });
          // 422 = request inválido pero API accesible — es lo esperado
          return { resend: { status: (res.ok || res.status === 422) ? 'up' : 'down', httpStatus: res.status } };
        } catch {
          return { resend: { status: 'down', message: 'unreachable' } };
        }
      },
    ]);
  }
}
