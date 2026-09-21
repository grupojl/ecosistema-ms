// chatia-backend/src/health/health.controller.ts
//
// /health extendido para superadmin (ADR-013 / ECO-H-01).
// Shape esperado: { status, db, redis, circuitBreakers[], dlqDepth{}, uptime, version }
// superadmin lo consume via ChatiaClient.getHealth() con TTL 15s.
//
// Circuit Breakers: common/services/circuit-breaker.service.ts (opossum)
// DLQ depth: BullMQ getFailedCount() en las queues DLQ
// Railway healthcheck: GET /health → 200 en < 200ms — NO requiere auth
import { Controller, Get }         from '@nestjs/common';
import { InjectQueue }              from '@nestjs/bullmq';
import type { Queue }               from 'bullmq';
import { PrismaService }            from '../prisma/prisma.service.js';
import { CircuitBreakerService }    from '../common/services/circuit-breaker.service.js';
import { QUEUES }                   from '../queue/queue.constants.js';

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
    private readonly prisma:    PrismaService,
    private readonly cbService: CircuitBreakerService,
    @InjectQueue(QUEUES.INCOMING_MESSAGES)  private readonly incomingQueue: Queue,
    @InjectQueue(QUEUES.OUTGOING_MESSAGES)  private readonly outgoingQueue: Queue,
  ) {}

  @Get()
  async check(): Promise<ExtendedHealth> {
    // DB + Redis en paralelo — allSettled: si uno falla, el otro responde igual
    const [dbResult, redisResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.prisma.$queryRaw`SELECT 1`, // Prisma usa el pool — ping indirecto
    ]);

    // Circuit Breakers desde opossum
    // CircuitBreakerService.getAll() devuelve Record<string, 'CLOSED'|'OPEN'|'HALF_OPEN'>
    const cbStates = await this.cbService.getAll().catch(() => ({}));
    const circuitBreakers = Object.entries(cbStates).map(([key, status]) => ({
      key,
      status: status as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    }));

    // DLQ depth — failed jobs en BullMQ (la DLQ es la queue de jobs fallidos)
    const [incomingFailed, outgoingFailed] = await Promise.allSettled([
      this.incomingQueue.getFailedCount(),
      this.outgoingQueue.getFailedCount(),
    ]);

    const dlqDepth: Record<string, number> = {
      'incoming-message-dlq': incomingFailed.status === 'fulfilled' ? incomingFailed.value : 0,
      'outgoing-message-dlq': outgoingFailed.status === 'fulfilled' ? outgoingFailed.value : 0,
    };

    const dbOk    = dbResult.status    === 'fulfilled';
    const redisOk = redisResult.status === 'fulfilled';

    return {
      status:  dbOk && redisOk ? 'ok' : 'degraded',
      db:      dbOk,
      redis:   redisOk,
      circuitBreakers,
      dlqDepth,
      uptime:  Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
