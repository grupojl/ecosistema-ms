// chatia-backend/src/common/services/circuit-breaker.service.ts
// Mismo patron que pasarelapagos y notificaciones-backend. ADR-005.
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  timeout?:         number;
  errorThreshold?:  number;
  resetTimeout?:    number;
  volumeThreshold?: number;
}

export class CircuitOpenError extends Error {
  constructor(key: string) {
    super(`Circuit breaker open for: ${key}`);
    this.name = 'CircuitOpenError';
  }
}

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger   = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreaker<unknown[], unknown>>();

  /**
   * Parametros recomendados por integración:
   *   groq-llm:        timeout:15000, errorThreshold:30, resetTimeout:120000
   *   whatsapp-send:   timeout:10000, errorThreshold:40, resetTimeout:60000
   *   instagram-send:  timeout:10000, errorThreshold:40, resetTimeout:60000
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options: CircuitBreakerOptions = {},
  ): Promise<T> {
    const breaker = this.getOrCreate(key, fn, options);
    try {
      return await breaker.fire() as T;
    } catch (err) {
      if (breaker.opened) throw new CircuitOpenError(key);
      throw err;
    }
  }

  healthOf(key: string): 'closed' | 'open' | 'halfOpen' | 'unknown' {
    const b = this.breakers.get(key);
    if (!b)          return 'unknown';
    if (b.opened)    return 'open';
    if (b.halfOpen)  return 'halfOpen';
    return 'closed';
  }

  onModuleDestroy() {
    for (const [, b] of this.breakers) b.shutdown();
    this.breakers.clear();
  }

  private getOrCreate<T>(
    key: string,
    fn: () => Promise<T>,
    opts: CircuitBreakerOptions,
  ): CircuitBreaker<unknown[], T> {
    if (this.breakers.has(key)) {
      return this.breakers.get(key) as unknown as CircuitBreaker<unknown[], T>;
    }
    const breaker = new CircuitBreaker(fn, {
      timeout:                  opts.timeout        ?? 10_000,
      errorThresholdPercentage: opts.errorThreshold ?? 40,
      resetTimeout:             opts.resetTimeout   ?? 60_000,
      volumeThreshold:          opts.volumeThreshold ?? 5,
    });
    breaker.on('open',     () => this.logger.warn(`CB open: ${key}`));
    breaker.on('halfOpen', () => this.logger.log(`CB half-open: ${key}`));
    breaker.on('close',    () => this.logger.log(`CB closed: ${key}`));
    this.breakers.set(key, breaker as unknown as CircuitBreaker<unknown[], unknown>);
    return breaker;
  }
}
