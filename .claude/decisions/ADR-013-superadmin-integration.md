# ADR-013 — Integración con superadmin (grupojl-control)

**Fecha:** 2026-09-19
**Estado:** Implementado ✅
**Repo:** grupojl/ecosistema-ms

## Qué se implementó

### /health extendido — los 5 MS

Shape que superadmin espera de cada MS:

```ts
interface ExtendedHealth {
  status:          'ok' | 'degraded' | 'down';
  db:              boolean;
  redis:           boolean;
  circuitBreakers: Array<{ key: string; status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' }>;
  dlqDepth:        Record<string, number>;
  uptime:          number;
  version:         string;
}
```

| MS | circuitBreakers | dlqDepth |
|----|-----------------|----------|
| chatia-backend | groq-api, whatsapp-webhook | incoming-messages-dlq, outgoing-messages-dlq |
| pasarelapagos-backend | providers (por proveedor) | reconcile-dlq, webhook-dlq |
| notificaciones-backend | whatsapp-cb, email-cb, push-cb | whatsapp-dlq, email-dlq, push-dlq |
| analytics-backend | [] (sin CBs) | {} (sin queues) |
| workers-backend | [] (CBs internos, no expuestos) | faq-ingest-dlq, vector-index-dlq, campaign-email-dlq |

### /internal/* — 3 MS con InternalModule

#### chatia-backend/src/internal/
- `GET  /internal/conversations/escalated` — conversaciones sin respuesta
- `GET  /internal/conversations/stats`
- `InternalApiKeyGuard` — valida x-internal-api-key

#### pasarelapagos-backend/src/internal/
- `GET  /internal/payments` — lista de pagos con filtros
- `GET  /internal/payments/:id`
- `POST /internal/payments/:id/retry`
- `InternalApiKeyGuard`

#### workers-backend/src/internal/
- `GET  /internal/jobs/dlq` — jobs en dead letter queue
- `POST /internal/jobs/dlq/:queue/:id/retry`
- `InternalApiKeyGuard`

### notificaciones-backend y analytics-backend
Sin /internal/ — solo /health extendido.
notificaciones: no hay datos de negocio que superadmin necesite en Fase 1.
analytics: solo es consumido por los propios MS vía gRPC.

## Decisiones

- InternalApiKeyGuard valida `Authorization: Bearer $INTERNAL_API_KEY`
- Sin TenantGuard — las rutas /internal/ son entre backs, no de tenants
- /health sin auth — Railway healthcheck no tiene token

## Pendiente de producción

- Configurar `INTERNAL_API_KEY` en Railway como variable compartida
  en todos los servicios de este repo + grupojl-control-backend
