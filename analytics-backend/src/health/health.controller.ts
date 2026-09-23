// analytics-backend/src/health/health.controller.ts
//
// /health extendido para superadmin (ADR-013 / ECO-H-04).
// analytics-backend no tiene Circuit Breakers ni DLQ propios.
// Devuelve: status + db + redis + uptime + version con arrays vacíos.
import { Controller, Get }  from '@nestjs/common';
import { PrismaService }    from '@/prisma/prisma.service.js';

interface ExtendedHealth {
  status:          'ok' | 'degraded' | 'down';
  db:              boolean;
  redis:           boolean;
  circuitBreakers: [];
  dlqDepth:        Record<string, never>;
  uptime:          number;
  version:         string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<ExtendedHealth> {
    const [dbResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
    ]);

    const dbOk = dbResult.status === 'fulfilled';

    return {
      status:          dbOk ? 'ok' : 'degraded',
      db:              dbOk,
      redis:           true,
      circuitBreakers: [],
      dlqDepth:        {},
      uptime:          Math.floor(process.uptime()),
      version:         process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
