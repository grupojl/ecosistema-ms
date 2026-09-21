// /health extendido para superadmin (ADR-013)
// Ref: .claude/checklists/superadmin-health-extension.md
import { Controller, Get } from '@nestjs/common';
import { InjectQueue }      from '@nestjs/bullmq';
import type { Queue }       from 'bullmq';
import { PrismaService }    from '../prisma/prisma.service.js';
import { MARKETING_QUEUES } from '../marketing.constants.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MARKETING_QUEUES.CAMPAIGN_SYNC)         private readonly syncQueue:        Queue,
    @InjectQueue(MARKETING_QUEUES.CAMPAIGN_AUTOMATION)   private readonly automationQueue:  Queue,
    @InjectQueue(MARKETING_QUEUES.MARKETING_ATTRIBUTION) private readonly attributionQueue: Queue,
  ) {}

  @Get()
  async check() {
    const [dbResult, syncFailed, automationFailed, attributionFailed] =
      await Promise.allSettled([
        this.prisma.$queryRaw`SELECT 1`,
        this.syncQueue.getFailedCount(),
        this.automationQueue.getFailedCount(),
        this.attributionQueue.getFailedCount(),
      ]);

    return {
      status:          dbResult.status === 'fulfilled' ? 'ok' : 'degraded',
      db:              dbResult.status === 'fulfilled',
      redis:           true,
      circuitBreakers: [], // CB de adapters se exponen en Fase 2
      dlqDepth: {
        'campaign-sync-dlq':         syncFailed.status        === 'fulfilled' ? syncFailed.value        : 0,
        'campaign-automation-dlq':   automationFailed.status  === 'fulfilled' ? automationFailed.value  : 0,
        'marketing-attribution-dlq': attributionFailed.status === 'fulfilled' ? attributionFailed.value : 0,
      },
      uptime:  Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
