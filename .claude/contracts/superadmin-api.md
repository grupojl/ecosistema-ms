# Contrato: API interna para superadmin

## Patrón de autenticación

```
Header:   x-internal-api-key: <INTERNAL_API_KEY>
Ruta:     /internal/<recurso>   o   /health (extendido)
Guard:    InternalApiKeyGuard — molde en chatia-backend/src/internal/
Timeout:  superadmin espera máximo 5 segundos
```

`INTERNAL_API_KEY` es la misma en todos los MS y en superadmin.
Es una variable de entorno — nunca hardcodeada en código.

---

## Shape del /health extendido

**Todos los MS deben devolver este shape** (superadmin los consume via
ChatiaClient, PasarelapagosClient, etc. que esperan exactamente esto):

```ts
interface ExtendedHealth {
  status:          'ok' | 'degraded' | 'down';
  db:              boolean;
  redis:           boolean;
  circuitBreakers: Array<{
    key:    string;
    status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  }>;
  dlqDepth:        Record<string, number>;
  uptime:          number;
  version:         string;
}
```

`status: 'degraded'` cuando DB o Redis responde pero con latencia alta.
`status: 'down'` cuando no puede conectar.

### CBs y DLQ por servicio

| Servicio | circuitBreakers[].key | dlqDepth keys |
|----------|----------------------|---------------|
| chatia-backend | groq-llm, whatsapp-send, instagram-send | incoming-message-dlq, outgoing-message-dlq |
| pasarelapagos-backend | mercadopago, stripe, dlocal, conekta | webhooks-dlq, reconcile-dlq |
| notificaciones-backend | sendgrid, whatsapp-biz-api, fcm | notification-queue-dlq |
| analytics-backend | (array vacío []) | (objeto vacío {}) |
| workers-backend | (array vacío []) | faq-ingest-dlq, vector-index-dlq, campaign-email-dlq |

---

## Endpoints /internal/* por servicio

### chatia-backend — YA TIENE InternalModule

**Estado actual:** `src/internal/` con guard e InternalController.
Verificar qué endpoints ya existen y cuáles hay que agregar.

```
GET  /internal/conversations/escalated
     ?ecosystemId=string
     &minutesWithoutResponse=number (default 60)
     &limit=number (default 50)
     Header: x-internal-api-key

Response:
[{
  id:             string
  ecosystemId:    string
  organizationId: string
  channel:        string          // 'WHATSAPP' | 'INSTAGRAM' etc.
  contactName:    string
  agentName:      string | null
  lastMessageAt:  string          // ISO
  minutesWaiting: number
}]
```

```
GET  /internal/conversations/stats
     ?ecosystemId=string&from=string&to=string
     Header: x-internal-api-key

Response:
{
  total:      number
  resolved:   number
  escalated:  number
  avgResponseMinutes: number
}
```

### pasarelapagos-backend — CREAR InternalModule

Copiar molde de chatia-backend: `src/internal/`

```
GET  /internal/payments
     ?ecosystemId=string&orgId=string&status=string&page=number&limit=number
     Header: x-internal-api-key

Response:
{
  data: [{
    id:             string
    ecosystemId:    string
    organizationId: string
    amount:         number
    currency:       string
    status:         string
    provider:       string
    createdAt:      string
    failureReason?: string
  }]
  total:   number
  page:    number
  limit:   number
}
```

```
GET  /internal/payments/:id
     Header: x-internal-api-key
     Response: (mismo shape que item arriba)
```

```
POST /internal/payments/:id/retry
     Header: x-internal-api-key
     Body: { reason: string }   // reason min 10 chars
     Response: { paymentId: string, newStatus: string, retryCount: number }
```

### notificaciones-backend — solo /health extendido en Fase 1

No necesita endpoints /internal/* adicionales en Fase 1.
Fase 2 puede agregar stats de notificaciones si se necesita.

### analytics-backend — solo /health extendido en Fase 1

```
GET  /internal/metrics/summary
     ?ecosystemId=string&from=string&to=string
     Header: x-internal-api-key
     (Fase 3 — no urgente)
```

### workers-backend — DLQ viewer

```
GET  /internal/jobs/dlq
     ?queue=string&limit=number (default 20)
     Header: x-internal-api-key

Response:
[{
  id:           string
  queue:        string
  name:         string
  failedAt:     string
  attemptsMade: number
  failReason:   string
  data:         Record<string, unknown>
}]
```

```
POST /internal/jobs/dlq/:id/retry
     Header: x-internal-api-key
     Body: { reason: string }  // min 10 chars
     Response: { jobId: string, status: 'queued' }
```
