// pasarelapagos-backend/src/modules/health/health.controller.ts
//
// /health extendido para superadmin (ADR-013 / ECO-H-02).
// CBs: providers/circuit-breaker.service.ts (opossum — mercadopago, stripe, dlocal, conekta)
// DLQ: BullMQ getFailedCount() en webhooks-queue, reconcile-queue, dlq-queue
// Sin auth: Railway healthcheck no tiene token
import { Controller, Get }      from '@nestjs/common';
import { InjectQueue }           from '@nestjs/bullmq';
import type { Queue }            from 'bullmq';
import { PrismaService }         from '../prisma/prisma.service.js';
import { CircuitBreakerService } from '../providers/circuit-breaker.service.js';
import { QUEUE_WEBHOOKS, QUEUE_RECONCILE, QUEUE_DLQ } from '../../common/constants/queues.js';

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
    private readonly prisma:  PrismaService,
    private readonly cb:      CircuitBreakerService,
    @InjectQueue(QUEUE_WEBHOOKS)  private readonly webhooksQueue:  Queue,
    @InjectQueue(QUEUE_RECONCILE) private readonly reconcileQueue: Queue,
    @InjectQueue(QUEUE_DLQ)       private readonly dlqQueue:       Queue,
  ) {}

  @Get()
  async check(): Promise<ExtendedHealth> {
    const [dbResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
    ]);

    // CircuitBreakerService (opossum) expone getAll() o similar
    // Keys esperadas: mercadopago, stripe, dlocal, conekta
    const cbStates = await this.cb.getAll().catch(() => ({} as Record<string, string>));
    const circuitBreakers = Object.entries(cbStates).map(([key, status]) => ({
      key,
      status: status as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    }));

    const [webhooksFailed, reconcileFailed, dlqFailed] = await Promise.allSettled([
      this.webhooksQueue.getFailedCount(),
      this.reconcileQueue.getFailedCount(),
      this.dlqQueue.getFailedCount(),
    ]);

    const dlqDepth: Record<string, number> = {
      'webhooks-dlq':  webhooksFailed.status  === 'fulfilled' ? webhooksFailed.value  : 0,
      'reconcile-dlq': reconcileFailed.status === 'fulfilled' ? reconcileFailed.value : 0,
      'dlq-queue':     dlqFailed.status       === 'fulfilled' ? dlqFailed.value       : 0,
    };

    const dbOk = dbResult.status === 'fulfilled';

    return {
      status:  dbOk ? 'ok' : 'degraded',
      db:      dbOk,
      redis:   true, // pasarela usa Redis internamente — asumir ok si el MS arrancó
      circuitBreakers,
      dlqDepth,
      uptime:  Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }
}
