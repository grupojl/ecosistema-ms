// src/infrastructure/security/rate-limit.service.ts
//
// Contador por ventana fija: Redis (compartido entre réplicas) con respaldo en memoria.
// Se usa para proteger endpoints públicos que cuestan plata (widget → LLM) y para cuotas diarias.
// Si Redis falla, degrada a memoria local en vez de dejar de limitar (nunca fail open sin límite).
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSec: number;
}

interface MemoryEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private redis: Redis | null = null;

  constructor() {
    if (process.env['REDIS_ENABLED'] === 'true') {
      this.redis = new Redis(
        process.env['REDIS_URL'] ?? 'redis://localhost:6379',
        {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 2_000,
        },
      );
      this.redis.on('error', (err: Error) =>
        this.logger.warn(`Redis (rate limit): ${err.message}`),
      );
    }
  }

  /** Registra un hit y dice si está dentro del límite. `windowSec` = tamaño de la ventana. */
  async hit(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    if (this.redis) {
      try {
        return await this.hitRedis(this.redis, key, limit, windowSec);
      } catch (err) {
        this.logger.warn(
          `Rate limit con Redis falló, uso memoria local: ${String(err)}`,
        );
      }
    }
    return this.hitMemory(key, limit, windowSec);
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
    this.memory.clear();
  }

  private async hitRedis(
    redis: Redis,
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, windowSec);
    const ttl = await redis.ttl(redisKey);
    // ttl -1 = clave sin expiración (el EXPIRE se perdió): se corrige para que no quede bloqueada para siempre
    if (ttl === -1) await redis.expire(redisKey, windowSec);
    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfterSec: ttl > 0 ? ttl : windowSec,
    };
  }

  private hitMemory(
    key: string,
    limit: number,
    windowSec: number,
  ): RateLimitResult {
    const now = Date.now();
    if (this.memory.size > 10_000) this.sweep(now);

    let entry = this.memory.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowSec * 1000 };
      this.memory.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= limit,
      count: entry.count,
      limit,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.memory) {
      if (entry.resetAt <= now) this.memory.delete(key);
    }
  }
}
