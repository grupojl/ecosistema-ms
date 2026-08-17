// analytics-backend/src/analytics/sse/sse.service.ts
//
// A-3.3: Server-Sent Events para dashboard en tiempo real.
// Cada conexión SSE se suscribe a eventos de analytics via Redis pub/sub.
// Límite: MAX_SSE_CONNECTIONS por instancia (configurable via env).
//
// Welver recibe: { eventType, organizationId, count, timestamp }
// Actualiza contadores "en vivo" sin reload de página.

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService }                        from '@nestjs/config';
import type { Response }                        from 'express';
import { Redis }                                from 'ioredis';

const MAX_SSE_CONNECTIONS = 100;
const HEARTBEAT_MS        = 25_000; // 25s para mantener conexiones vivas
const SSE_CHANNEL         = 'analytics:live';

export interface LiveEvent {
  eventType:      string;
  organizationId: string;
  ecosystemId:    string;
  count?:         number;
  timestamp:      number;
}

interface SseClient {
  organizationId: string;
  res:            Response;
  heartbeat:      NodeJS.Timeout;
}

@Injectable()
export class SseService implements OnModuleDestroy {
  private readonly logger  = new Logger(SseService.name);
  private readonly clients = new Map<string, SseClient>(); // clientId → client
  private subscriber!: Redis;
  private readonly maxConnections: number;

  constructor(private readonly config: ConfigService) {
    this.maxConnections = parseInt(
      config.get<string>('MAX_SSE_CONNECTIONS', String(MAX_SSE_CONNECTIONS)),
      10,
    );
  }

  async onModuleInit(): Promise<void> {
    // Subscriber dedicado — no usar el mismo cliente que el publisher
    this.subscriber = new Redis({
      host:     this.config.get<string>('REDIS_HOST', 'localhost'),
      port:     parseInt(this.config.get<string>('REDIS_PORT', '6379'), 10),
      password: this.config.get<string>('REDIS_PASSWORD'),
    });

    await this.subscriber.subscribe(SSE_CHANNEL);

    this.subscriber.on('message', (_channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as LiveEvent;
        this.broadcast(event);
      } catch {
        // mensaje mal formado — ignorar
      }
    });

    this.logger.log(`SSE service listo — max ${this.maxConnections} conexiones`);
  }

  onModuleDestroy(): void {
    for (const [, client] of this.clients) {
      clearInterval(client.heartbeat);
      client.res.end();
    }
    this.clients.clear();
    void this.subscriber?.quit();
  }

  /**
   * Registra una nueva conexión SSE.
   * Retorna el clientId para poder desconectar cuando el cliente cierra.
   */
  addClient(organizationId: string, res: Response): string {
    if (this.clients.size >= this.maxConnections) {
      res.status(503).json({ error: 'Máximo de conexiones SSE alcanzado' });
      return '';
    }

    const clientId = `${organizationId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

    // Configurar headers SSE
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nginx: deshabilitar buffering
    res.flushHeaders();

    // Enviar evento de conexión exitosa
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId, timestamp: Date.now() })}\n\n`);

    // Heartbeat para mantener la conexión viva
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, HEARTBEAT_MS);

    this.clients.set(clientId, { organizationId, res, heartbeat });
    this.logger.debug(`SSE cliente conectado: ${clientId} (total: ${this.clients.size})`);

    return clientId;
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    clearInterval(client.heartbeat);
    this.clients.delete(clientId);
    this.logger.debug(`SSE cliente desconectado: ${clientId} (total: ${this.clients.size})`);
  }

  /**
   * Emite un evento a Redis pub/sub — todos los pods lo reciben y
   * lo reenvían a sus clientes conectados.
   */
  async publish(event: LiveEvent, publisher: Redis): Promise<void> {
    await publisher.publish(SSE_CHANNEL, JSON.stringify(event));
  }

  getConnectionCount(): number {
    return this.clients.size;
  }

  // ── Broadcast a clientes de la org ────────────────────────────────────────

  private broadcast(event: LiveEvent): void {
    for (const [clientId, client] of this.clients) {
      if (client.organizationId !== event.organizationId) continue;
      try {
        client.res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        // Cliente desconectado — limpiar
        this.removeClient(clientId);
      }
    }
  }
}
