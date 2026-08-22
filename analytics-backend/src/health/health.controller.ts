// analytics-backend/src/health/health.controller.ts
import { Controller, Get }                          from '@nestjs/common';
import { ApiTags }                                  from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthCheckResult, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService }  from '../prisma/prisma.service.js';
import { Public }         from '@ecosistema-ms/auth-server';

@ApiTags('health')
@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' as const } };
        } catch (e: unknown) {
          return { database: { status: 'down' as const, error: String(e) } };
        }
      },
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
