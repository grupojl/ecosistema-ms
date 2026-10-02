// workers-backend/src/jobs/services/circuit-breaker.service.ts
//
// W-3.2: Circuit Breaker para dependencias externas (Groq, OpenAI).
// Implementado sobre Redis sin dep de opossum — más liviano.
//
// Estados: CLOSED (normal) → OPEN (falla) → HALF_OPEN (prueba)
//
// Config por servicio:
//   failureThreshold: nro de fallos para abrir
//   resetTimeoutMs:   tiempo en OPEN antes de pasar a HALF_OPEN
//
// El estado se expone en /health para visibilidad operacional.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { Redis }              from 'ioredis';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface BreakerConfig {
  failureThreshold: number;
  resetTimeoutMs:   number;
  successThreshold: number; // éxitos en HALF_OPEN para cerrar
}

const DEFAULTS: BreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs:   30_000,
  successThreshold: 2,
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly redis:  Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis({
      host:     config.get<string>('REDIS_HOST', 'localhost'),
      port:     parseInt(config.get<string>('REDIS_PORT', '6379'), 10),
      password: config.get<string>('REDIS_PASSWORD'),
    });
  }

  /**
   * Ejecuta fn protegido por el circuit breaker identificado por key.
   * Lanza error si el circuito está OPEN.
   */
  async execute<T>(
    key:     string,
    fn:      () => Promise<T>,
    options: Partial<BreakerConfig> = {},
  ): Promise<T> {
    const cfg   = { ...DEFAULTS, ...options };
    const state = await this.getState(key);

    if (state === 'OPEN') {
      // Verificar si es hora de pasar a HALF_OPEN
      const openSince = await this.redis.get(`cb:${key}:open_since`);
      if (openSince && Date.now() - parseInt(openSince, 10) > cfg.resetTimeoutMs) {
        await this.setState(key, 'HALF_OPEN');
        this.logger.log(`Circuit breaker ${key}: OPEN → HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker OPEN para ${key} — servicio no disponible`);
      }
    }

    try {
      const result = await fn();
      await this.onSuccess(key, cfg);
      return result;
    } catch (error: unknown) {
      await this.onFailure(key, cfg);
      throw error;
    }
  }

  async getState(key: string): Promise<CircuitState> {
    const state = await this.redis.get(`cb:${key}:state`);
    return (state as CircuitState | null) ?? 'CLOSED';
  }

  async getAllStates(): Promise<Record<string, CircuitState>> {
    const keys = await this.redis.keys('cb:*:state');
    const result: Record<string, CircuitState> = {};
    for (const k of keys) {
      const service = k.replace('cb:', '').replace(':state', '');
      result[service] = (await this.redis.get(k) as CircuitState | null) ?? 'CLOSED';
    }
    return result;
  }

  // ── Transiciones de estado ────────────────────────────────────────────────

  private async onSuccess(key: string, cfg: BreakerConfig): Promise<void> {
    const state = await this.getState(key);

    if (state === 'HALF_OPEN') {
      const successes = await this.redis.incr(`cb:${key}:half_open_successes`);
      if (successes >= cfg.successThreshold) {
        await this.setState(key, 'CLOSED');
        await this.redis.del(`cb:${key}:failures`, `cb:${key}:half_open_successes`, `cb:${key}:open_since`);
        this.logger.log(`Circuit breaker ${key}: HALF_OPEN → CLOSED`);
      }
    } else if (state === 'CLOSED') {
      // Reset failure counter en éxito
      await this.redis.del(`cb:${key}:failures`);
    }
  }

  private async onFailure(key: string, cfg: BreakerConfig): Promise<void> {
    const state    = await this.getState(key);
    const failures = await this.redis.incr(`cb:${key}:failures`);

    if (state === 'HALF_OPEN') {
      // Cualquier falla en HALF_OPEN → volver a OPEN
      await this.setState(key, 'OPEN');
      await this.redis.set(`cb:${key}:open_since`, String(Date.now()));
      this.logger.warn(`Circuit breaker ${key}: HALF_OPEN → OPEN (falla en prueba)`);
      return;
    }

    if (failures >= cfg.failureThreshold) {
      await this.setState(key, 'OPEN');
      await this.redis.set(`cb:${key}:open_since`, String(Date.now()));
      this.logger.error(
        `Circuit breaker ${key}: CLOSED → OPEN (${failures} fallos consecutivos)`,
      );
    }
  }

  private async setState(key: string, state: CircuitState): Promise<void> {
    await this.redis.set(`cb:${key}:state`, state);
  }
}
