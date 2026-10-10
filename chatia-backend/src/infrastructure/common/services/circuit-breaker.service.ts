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
  // El breaker es un dispatcher: recibe la operación en cada fire() y la ejecuta.
  // (Crearlo con `fn` fijo repetiría siempre la primera llamada.)
  private readonly breakers = new Map<string, CircuitBreaker<[() => Promise<unknown>], unknown>>();

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
    const breaker = this.getOrCreate(key, options);
    try {
      return await breaker.fire(fn) as T;
    } catch (err) {
      if (breaker.opened) throw new CircuitOpenError(key);
      throw err;
    }
  }

  /** Estado de todos los breakers registrados (para /health extendido). */
  getAll(): Promise<Record<string, 'CLOSED' | 'OPEN' | 'HALF_OPEN'>> {
    const map = { closed: 'CLOSED', open: 'OPEN', halfOpen: 'HALF_OPEN', unknown: 'CLOSED' } as const;
    const out: Record<string, 'CLOSED' | 'OPEN' | 'HALF_OPEN'> = {};
    for (const key of this.breakers.keys()) out[key] = map[this.healthOf(key)];
    return Promise.resolve(out);
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

  private getOrCreate(
    key: string,
    opts: CircuitBreakerOptions,
  ): CircuitBreaker<[() => Promise<unknown>], unknown> {
    const existing = this.breakers.get(key);
    if (existing) return existing;
    const breaker = new CircuitBreaker((op: () => Promise<unknown>) => op(), {
      timeout:                  opts.timeout        ?? 10_000,
      errorThresholdPercentage: opts.errorThreshold ?? 40,
      resetTimeout:             opts.resetTimeout   ?? 60_000,
      volumeThreshold:          opts.volumeThreshold ?? 5,
    });
    breaker.on('open',     () => this.logger.warn(`CB open: ${key}`));
    breaker.on('halfOpen', () => this.logger.log(`CB half-open: ${key}`));
    breaker.on('close',    () => this.logger.log(`CB closed: ${key}`));
    this.breakers.set(key, breaker);
    return breaker;
  }
}
