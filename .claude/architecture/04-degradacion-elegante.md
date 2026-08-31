# Degradacion elegante — patrones obligatorios

## El principio

Un fallo en un microservicio NO debe degradar el servicio principal.
Cada integracion externa tiene un plan de fallback explicito.

## Patron implementado correctamente: fire-and-forget en analytics

chatia-backend/src/analytics-events/analytics-events.service.ts:
  attempts: 1,  // best-effort — sin retry
  // NUNCA hacer await de esto en path critico

Si analytics cae, el chat continua. Esto es correcto.
Aplicar el mismo patron en cualquier integracion no-critica.

## Patron implementado correctamente: fallback en routing de pagos

pasarelapagos-backend/src/modules/providers/routing.service.ts:
  // Si todos los CB estan abiertos -> fallback al registry en memoria
  const fallback = this.registry.findAny(country, currency, method);

## Patrones pendientes — DT-004

### Fallback de LLM en chatia

```typescript
// Cuando Groq CB esta abierto -> respuesta predefinida + escalar a humano
if (err instanceof CircuitOpenError) {
  await this.escalateToHuman(conversationId);
  return { response: config.fallbackMessage, usedFaqFallback: false };
}
```

### CB en adapters de notificaciones

Sin CB, fallo de SendGrid o WhatsApp Business API -> cascade en DLQ.
Ver checklist circuit-breaker-adapters.md.

## Reglas duras

1. AnalyticsEventsService.track() — NUNCA await en path de request HTTP
2. Todos los adapters externos DEBEN tener CB antes de produccion seria
3. Fallback de LLM SIEMPRE hacia AssistantConfig.fallbackMessage — nunca string hardcodeado
4. DLQ processor NUNCA lanza excepciones — solo loguea y ack el job
5. SSE disconnection NUNCA propaga al caller — removeClient() es silencioso

## RedisNoopClient — patron para dev sin Redis

pasarelapagos-backend/src/modules/redis/redis.module.ts tiene RedisNoopClient.
Cuando REDIS_ENABLED=false -> mock sin conexion de red.
Replicar en los demas MS para facilitar desarrollo local.
