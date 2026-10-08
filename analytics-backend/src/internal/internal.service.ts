import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }        from '@/prisma/prisma.service.js';
import type { GetMetricsDto }   from '@/internal/schemas.js';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(dto: GetMetricsDto) {
    const where = {
      ecosystemId:    dto.ecosystemId,
      ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
    };

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // últimas 24h

    const [totalEvents, recentEvents] = await Promise.all([
      this.prisma.analyticsEvent.count({ where }),
      this.prisma.analyticsEvent.count({
        where: { ...where, occurredAt: { gte: since } },
      }),
    ]);

    return {
      ecosystemId:    dto.ecosystemId,
      organizationId: dto.organizationId ?? 'all',
      totalEvents,
      recentEvents24h: recentEvents,
      period: { from: since.toISOString(), to: new Date().toISOString() },
    };
  }

  async getHealth() {
    const count = await this.prisma.analyticsEvent.count();
    return {
      status:  'ok' as const,
      analytics: { totalEvents: count },
      uptime:  Math.floor(process.uptime()),
    };
  }
}
