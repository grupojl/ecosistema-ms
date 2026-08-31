# ADR-006 — Lock distribuido en schedulers con cron

**Estado:** Implementado
**Fecha:** 2024-Q4

## Decision

Todos los schedulers usan `SET NX EX` de Redis — no BullMQ como proxy.
El patron correcto ya estaba en analytics-backend/projections.service.ts.
Fue estandarizado en workers-backend/campaigns.service.ts.

## Completado

- [x] `analytics-backend`: `SET NX EX` en `projections.service.ts` — ya estaba correcto
- [x] `workers-backend`: `campaigns.service.ts` migrado a `SET NX EX`
  — reemplaza el lock simplificado con BullMQ que tenia race condition en multi-pod

## Patron canonico (copiar en schedulers futuros)

```typescript
const LOCK_KEY = 'workers:scheduler:{nombre}';
const LOCK_TTL = 55; // segundos — menos que el intervalo del cron

const lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
if (!lock) return; // otro pod tiene el lock

try {
  // ... logica del scheduler
} finally {
  await this.redis.del(LOCK_KEY).catch(() => {});
}
```
