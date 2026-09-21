// notificaciones-backend/src/health/health.controller.ts
//
// /health extendido para superadmin (ADR-013 / ECO-H-03).
// CBs: notifications/circuit-breaker.service.ts (sendgrid, whatsapp-biz-api, fcm)
// DLQ: DlqMonitorService.getDlqStats() — ya implementado
// Sin auth: Railway healthcheck no tiene token
import { Controller, Get }        from '@nestjs/common';
import { PrismaService }           from '../prisma/prisma.service.js';
import { CircuitBreakerService }   from '../notifications/circuit-breaker.service.js';
import { DlqMonitorService }       from '../notifications/dlq/dlq-monitor.service.js';

interface ExtendedHealth {
  status:          'ok' | 'degraded' | 'down';
  db:              boolean;
  redis:           boolean;
  circuitBreakers: Array<{ key: string; status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }>;
  dlqDepth:        Record<string, number>;
  uptime:          number;
  version:         string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cb:     CircuitBreakerService,
    private readonly dlq:    DlqMonitorService,
  ) {}

  @Get()
  async check(): Promise<ExtendedHealth> {
    const [dbResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
    ]);

    // CircuitBreakerService tiene getStates() o similar
    // Keys: sendgrid, whatsapp-biz-api, fcm
    const cbStates = await (this.cb as any).getStates?.().catch(() => ({})) ?? {};
    const circuitBreakers = Object.entries(cbStates as Record<string, string>).map(
      ([key, status]) => ({ key, status: status as 'CLOSED' | 'OPEN' | 'HALF_OPEN' }),
    );

    // DlqMonitorService.getDlqStats() ya devuelve { dlqSize, ... }
    const dlqStats = await this.dlq.getDlqStats().catch(() => ({ dlqSize: 0 }));
    const dlqDepth: Record<string, number> = {
      'notification-queue-dlq': dlqStats.dlqSize ?? 0,
    };

    const dbOk = dbResult.status === 'fulfilled';

    return {
      status:  dbOk ? 'ok' : 'degraded',
      db:      dbOk,
      redis:   true,
      circuitBreakers,
      dlqDepth,
      uptime:  Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
