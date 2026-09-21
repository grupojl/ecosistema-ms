// workers-backend/src/health/health.controller.ts
//
// /health extendido para superadmin (ADR-013 / ECO-H-05).
// CB: CircuitBreakerService (Redis-based) — getAllStates()
// DLQ: BullMQ getFailedCount() por queue (faq-ingest, vector-index, campaign-email)
// Sin auth: Railway healthcheck no tiene token
import { Controller, Get }           from '@nestjs/common';
import { InjectQueue }                from '@nestjs/bullmq';
import type { Queue }                 from 'bullmq';
import { PrismaService }              from '../prisma/prisma.service.js';
import { CircuitBreakerService }      from '../jobs/services/circuit-breaker.service.js';
import { WORKER_QUEUES }              from '../jobs/jobs.constants.js';

interface ExtendedHealth {
  status:          'ok' | 'degraded' | 'down';
  db:              boolean;
  redis:           boolean;
  circuitBreakers: [];
  dlqDepth:        Record<string, number>;
  uptime:          number;
  version:         string;
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly cb:      CircuitBreakerService,
    @InjectQueue(WORKER_QUEUES.FAQ_INGEST)     private readonly faqQueue:      Queue,
    @InjectQueue(WORKER_QUEUES.VECTOR_INDEX)   private readonly vectorQueue:   Queue,
    @InjectQueue(WORKER_QUEUES.CAMPAIGN_EMAIL) private readonly campaignQueue: Queue,
  ) {}

  @Get()
  async check(): Promise<ExtendedHealth> {
    const [dbResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
    ]);

    // workers-backend usa CB sobre Redis pero solo para Groq/embeddings
    // No los exponemos como CBs del health — son internos del job
    // circuitBreakers: [] es correcto para este MS

    const [faqFailed, vectorFailed, campaignFailed] = await Promise.allSettled([
      this.faqQueue.getFailedCount(),
      this.vectorQueue.getFailedCount(),
      this.campaignQueue.getFailedCount(),
    ]);

    const dlqDepth: Record<string, number> = {
      'faq-ingest-dlq':      faqFailed.status      === 'fulfilled' ? faqFailed.value      : 0,
      'vector-index-dlq':    vectorFailed.status    === 'fulfilled' ? vectorFailed.value    : 0,
      'campaign-email-dlq':  campaignFailed.status  === 'fulfilled' ? campaignFailed.value  : 0,
    };

    const dbOk = dbResult.status === 'fulfilled';

    return {
      status:          dbOk ? 'ok' : 'degraded',
      db:              dbOk,
      redis:           true,
      circuitBreakers: [],
      dlqDepth,
      uptime:          Math.floor(process.uptime()),
      version:         process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
