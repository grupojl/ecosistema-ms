// notificaciones-backend/src/notifications/circuit-breaker.service.ts
// Copiado del patron de pasarelapagos-backend — opossum como estandar. ADR-005.
// El mismo servicio funciona para cualquier llamada a proveedor externo.
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  timeout?:        number; // ms antes de considerar fallido (default: 8000)
  errorThreshold?: number; // % de errores para abrir (default: 40)
  resetTimeout?:   number; // ms hasta intentar half-open (default: 60000)
  volumeThreshold?: number; // minimo de requests para evaluar (default: 5)
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
   * Ejecuta fn protegida por un circuit breaker identificado por key.
   * Si el breaker esta abierto lanza CircuitOpenError inmediatamente.
   *
   * Parametros recomendados por canal:
   *   sendgrid:          timeout:8000, errorThreshold:40, resetTimeout:60000
   *   whatsapp-biz-api:  timeout:8000, errorThreshold:40, resetTimeout:60000
   *   fcm:               timeout:5000, errorThreshold:50, resetTimeout:30000
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
    if (!b) return 'unknown';
    if (b.opened)    return 'open';
    if (b.halfOpen)  return 'halfOpen';
    return 'closed';
  }

  statsOf(key: string) {
    const b = this.breakers.get(key);
    if (!b) return null;
    return b.stats;
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
      const existing = this.breakers.get(key)!;
      // Actualizar la accion si el fn cambio
      (existing as unknown as { action: () => Promise<T> }).action = fn;
      return existing as unknown as CircuitBreaker<unknown[], T>;
    }

    const breaker = new CircuitBreaker(fn, {
      timeout:        opts.timeout        ?? 8_000,
      errorThresholdPercentage: opts.errorThreshold ?? 40,
      resetTimeout:   opts.resetTimeout   ?? 60_000,
      volumeThreshold: opts.volumeThreshold ?? 5,
    });

    breaker.on('open',     () => this.logger.warn(`CB open: ${key}`));
    breaker.on('halfOpen', () => this.logger.log(`CB half-open: ${key}`));
    breaker.on('close',    () => this.logger.log(`CB closed: ${key}`));

    this.breakers.set(key, breaker as unknown as CircuitBreaker<unknown[], unknown>);
    return breaker;
  }
}
