// src/infrastructure/queue/bull-connection.ts
//
// Conexión única de BullMQ. Con REDIS_ENABLED=false varios módulos (health, dlq, faq, ...) igual
// registran sus colas: sin esto cada una reintentaba conectar a un Redis inexistente y llenaba el log
// de ECONNREFUSED. Deshabilitado → conexión perezosa y sin reintentos (un add() falla rápido).
import type { ConnectionOptions } from 'bullmq';

export function bullConnection(): ConnectionOptions {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  if (process.env['REDIS_ENABLED'] === 'true') return { url };
  return { url, lazyConnect: true, retryStrategy: () => null };
}
