// chatia-backend/src/infrastructure/transport/health/health.controller.ts
//
// GET /health        → extendido para superadmin (ADR-013 / ECO-H-01). Siempre 200 con el detalle.
//   Shape: { status, db, redis, circuitBreakers[], dlqDepth{}, uptime, version }
// GET /health/live   → el proceso está vivo (sin dependencias). Para reinicios por cuelgue.
// GET /health/ready  → DB y Redis responden (503 si no). Para que Railway enrute tráfico / valide el deploy.
//
// Antes el chequeo de "redis" era otra consulta a Postgres: reportaba Redis sano aunque estuviera caído.
// Ahora se hace PING real a Redis y cada chequeo tiene timeout propio.
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { SkipThrottle } from '@nestjs/throttler';
import type { Queue } from 'bullmq';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';
import { QUEUES } from '@/infrastructure/queue/queue.constants.js';

const CHECK_TIMEOUT_MS = 2_000;

interface ExtendedHealth {
  status: 'ok' | 'degraded' | 'down';
  db: boolean;
  redis: boolean;
  redisEnabled: boolean;
  circuitBreakers: Array<{
    key: string;
    status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  }>;
  dlqDepth: Record<string, number>;
  uptime: number;
  version: string;
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label}: timeout ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cbService: CircuitBreakerService,
    @InjectQueue(QUEUES.INCOMING_MESSAGE) private readonly incomingQueue: Queue,
    @InjectQueue(QUEUES.OUTGOING_MESSAGE) private readonly outgoingQueue: Queue,
  ) {}

  @Get('live')
  live(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ok'; db: true; redis: true | 'disabled' }> {
    const { db, redis, redisEnabled } = await this.dependencies();
    if (!db || !redis) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        db,
        redis,
        redisEnabled,
      });
    }
    return { status: 'ok', db: true, redis: redisEnabled ? true : 'disabled' };
  }

  @Get()
  async check(): Promise<ExtendedHealth> {
    const { db, redis, redisEnabled } = await this.dependencies();

    // Circuit Breakers desde opossum
    const cbStates = await this.cbService.getAll().catch(() => ({}));
    const circuitBreakers = Object.entries(cbStates).map(([key, status]) => ({
      key,
      status: status,
    }));

    // DLQ depth — failed jobs en BullMQ (la DLQ es la queue de jobs fallidos)
    const [incomingFailed, outgoingFailed] =
      redis && redisEnabled
        ? await Promise.allSettled([
            withTimeout(
              this.incomingQueue.getFailedCount(),
              CHECK_TIMEOUT_MS,
              'incoming.getFailedCount',
            ),
            withTimeout(
              this.outgoingQueue.getFailedCount(),
              CHECK_TIMEOUT_MS,
              'outgoing.getFailedCount',
            ),
          ])
        : [undefined, undefined];

    const depth = (r: PromiseSettledResult<number> | undefined): number =>
      r?.status === 'fulfilled' ? r.value : 0;

    return {
      status: !db ? 'down' : redis ? 'ok' : 'degraded',
      db,
      redis,
      redisEnabled,
      circuitBreakers,
      dlqDepth: {
        'incoming-message-dlq': depth(incomingFailed),
        'outgoing-message-dlq': depth(outgoingFailed),
      },
      uptime: Math.floor(process.uptime()),
      version: process.env['npm_package_version'] ?? '0.0.0',
    };
  }

  /** Chequeos reales e independientes: SELECT 1 en Postgres y PING a Redis. */
  private async dependencies(): Promise<{
    db: boolean;
    redis: boolean;
    redisEnabled: boolean;
  }> {
    const redisEnabled = process.env['REDIS_ENABLED'] === 'true';

    const [db, redis] = await Promise.allSettled([
      withTimeout(
        this.prisma.$queryRaw`SELECT 1`,
        CHECK_TIMEOUT_MS,
        'postgres',
      ),
      // BullMQ 6 no expone el cliente ioredis: getFailedCount ejecuta un comando real contra Redis
      redisEnabled
        ? withTimeout(
            this.incomingQueue.getFailedCount(),
            CHECK_TIMEOUT_MS,
            'redis',
          )
        : Promise.resolve(0),
    ]);

    return {
      db: db.status === 'fulfilled',
      // Redis deshabilitado por configuración no es una falla (queda indicado en redisEnabled)
      redis: redis.status === 'fulfilled',
      redisEnabled,
    };
  }
}
