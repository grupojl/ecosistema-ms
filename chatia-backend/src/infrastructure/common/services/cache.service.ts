// src/infrastructure/common/services/cache.service.ts
//
// Caché sobre Redis. Usa `ioredis` (dependencia declarada del servicio): antes importaba el paquete
// `redis`, que no figuraba en package.json y solo resolvía por hoisting.
// Si Redis no está disponible el servicio degrada a "no-op": la app funciona, sin caché.
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private connected = false;

  private get redisEnabled(): boolean {
    return process.env['REDIS_ENABLED'] === 'true';
  }

  async onModuleInit(): Promise<void> {
    // Sin este guard, el cliente intenta conectar aunque REDIS_ENABLED=false,
    // generando ECONNRESET en loop cada 30s e impidiendo el sleep en Railway.
    if (!this.redisEnabled) {
      this.logger.log(
        'CacheService: Redis deshabilitado (REDIS_ENABLED=false) — modo no-op',
      );
      return;
    }

    try {
      const client = new Redis(
        process.env['REDIS_URL'] ?? 'redis://localhost:6379',
        {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 5_000,
          // Corta después de 10 reintentos en lugar de reintentar eternamente
          retryStrategy: (retries: number) => {
            if (retries > 10) {
              this.logger.warn(
                'CacheService: Redis sin respuesta tras 10 reintentos — modo no-op',
              );
              this.connected = false;
              return null;
            }
            return Math.min(retries * 500, 5_000);
          },
        },
      );
      client.on('error', (err: Error) =>
        this.logger.warn(`Redis error: ${err.message}`),
      );
      client.on('ready', () => {
        this.connected = true;
      });
      client.on('end', () => {
        this.connected = false;
      });

      this.client = client;
      await client.connect();
      this.connected = true;
      this.logger.log('CacheService: Redis conectado');
    } catch (err) {
      this.logger.warn(
        `CacheService: Redis no disponible — modo no-op: ${String(err)}`,
      );
    }
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
    this.client = null;
    this.connected = false;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected || !this.client) return null;
    try {
      const val = await this.client.get(key);
      if (!val) return null;
      try {
        return JSON.parse(val) as T;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    if (!this.connected || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Cache set falló: ${String(err)}`);
    }
  }

  /**
   * Lock distribuido (SET NX EX) para tareas programadas con varias réplicas.
   * Sin Redis devuelve true: con una sola instancia no hay nadie con quien competir.
   * El lock no se libera: expira solo, así dos réplicas no repiten la tarea dentro de la ventana.
   */
  async tryLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.connected || !this.client) return true;
    try {
      const res = await this.client.set(
        `lock:${key}`,
        '1',
        'EX',
        ttlSeconds,
        'NX',
      );
      return res === 'OK';
    } catch (err) {
      this.logger.warn(`Cache tryLock falló: ${String(err)}`);
      return true; // ante la duda se ejecuta: la tarea es idempotente
    }
  }

  /** Borra las claves que coinciden con el patrón. Usa SCAN (KEYS bloquea Redis con muchas claves). */
  async del(pattern: string): Promise<void> {
    if (!this.connected || !this.client) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          200,
        );
        cursor = next;
        if (keys.length > 0) await this.client.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(`Cache del falló: ${String(err)}`);
    }
  }

  buildFaqKey(kbId: string, question: string): string {
    let hash = 0;
    for (let i = 0; i < question.length; i++) {
      hash = ((hash << 5) - hash + question.charCodeAt(i)) | 0;
    }
    return `faq:${kbId}:${Math.abs(hash)}`;
  }
}
