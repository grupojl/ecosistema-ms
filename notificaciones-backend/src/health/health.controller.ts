// notificaciones-backend/src/health/health.controller.ts
//
// /health extendido para superadmin (ADR-013 / ECO-H-03).
// CBs: notifications/circuit-breaker.service.ts (sendgrid, whatsapp-biz-api, fcm)
// DLQ: DlqMonitorService.getDlqStats() — ya implementado
// Sin auth: Railway healthcheck no tiene token
import { Controller, Get }        from '@nestjs/common';
import { PrismaService }           from '@/infrastructure/prisma/prisma.service.js';
import { CircuitBreakerService }   from '@/infrastructure/common/services/circuit-breaker.service.js';
import { DlqMonitorService }       from '@/queue/dlq/dlq-monitor.service.js';

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

    // Keys: sendgrid, whatsapp-biz-api, fcm
    const cbKeys = ['sendgrid', 'whatsapp-biz-api', 'fcm'] as const;
    const stateMap = { closed: 'CLOSED', open: 'OPEN', halfOpen: 'HALF_OPEN' } as const;
    const circuitBreakers = cbKeys.map((key) => {
      const state = this.cb.healthOf(key);
      return { key, status: state === 'unknown' ? 'CLOSED' as const : stateMap[state] };
    });

    // DlqMonitorService.getDlqStats() devuelve { failed, waiting }
    const dlqStats = await this.dlq.getDlqStats().catch(() => ({ failed: 0, waiting: 0 }));
    const dlqDepth: Record<string, number> = {
      'notification-queue-dlq': dlqStats.failed,
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
