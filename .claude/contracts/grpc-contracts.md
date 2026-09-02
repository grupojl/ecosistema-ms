# Contratos gRPC — ecosistema-ms

Fuente de verdad: `packages/proto/proto/*.proto`
Este archivo documenta los RPCs disponibles, sus shapes y los timeouts/fallbacks por par.

---

## analytics.proto — AnalyticsService (puerto 5004)

| RPC | Input | Output | Consumidores |
|-----|-------|--------|-------------|
| `TrackEvent` | `TrackEventRequest` | `TrackEventResponse` | chatia-backend |
| `GetOverview` | `OverviewRequest` | `OverviewResponse` | welver (dashboard) |
| `GetConversationsByDay` | `ConvByDayRequest` | `ConvByDayResponse` | welver |
| `GetAgentMetrics` | `AgentMetricsRequest` | `AgentMetricsResponse` | welver |

### Shapes principales

```protobuf
// TrackEventRequest
ecosystemId:    string
organizationId: string
eventType:      string
payload:        bytes (JSON serializado)
occurredAt:     int64 (unix timestamp)

// OverviewRequest
ecosystemId:    string
organizationId: string
from:           string (ISO date)
to:             string (ISO date)
```

---

## chatia.proto — ChatIAService (puerto 5001)

| RPC | Input | Output | Consumidores |
|-----|-------|--------|-------------|
| `SendMessage` | `SendMessageRequest` | `SendMessageResponse` | workers-backend |
| `GetConversation` | `GetConversationRequest` | `ConversationResponse` | welver |
| `ListConversations` | `ListConversationsRequest` | `ListConversationsResponse` | welver |
| `ResolveConversation` | `ResolveConversationRequest` | `ResolveConversationResponse` | workers-backend |

---

## notificaciones.proto — NotificacionesService (puerto 5003)

| RPC | Input | Output | Consumidores |
|-----|-------|--------|-------------|
| `Notify` | `NotifyRequest` | `NotifyResponse` | chatia-backend, welver |
| `GetStatus` | `GetStatusRequest` | `NotificationStatusResponse` | welver |

### Shape NotifyRequest

```protobuf
ecosystemId:    string
organizationId: string
contactId:      string
channel:        string  // WHATSAPP | EMAIL | PUSH
templateKey:    string
payload:        bytes   // JSON serializado
idempotencyKey: string
```

---

## pagos.proto — PagosService (puerto 5002)

| RPC | Input | Output | Consumidores |
|-----|-------|--------|-------------|
| `CreatePayment` | `CreatePaymentRequest` | `PaymentResponse` | chatia-backend, welver |
| `GetPayment` | `GetPaymentRequest` | `PaymentResponse` | welver |
| `RefundPayment` | `RefundRequest` | `RefundResponse` | welver |

---

## workers.proto — WorkersService (puerto 5005)

| RPC | Input | Output | Consumidores |
|-----|-------|--------|-------------|
| `EnqueueCampaign` | `EnqueueCampaignRequest` | `EnqueueCampaignResponse` | chatia-backend, welver |
| `GetCampaignStatus` | `GetCampaignStatusRequest` | `CampaignStatusResponse` | welver |
| `EnqueueVectorIndex` | `VectorIndexRequest` | `VectorIndexResponse` | chatia-backend |

---

## Timeouts y fallbacks por par consumidor→proveedor

| Consumidor | Proveedor | Timeout | Comportamiento en timeout | Estado |
|---|---|---|---|---|
| `chatia-backend` | `analytics-backend` | best-effort / sin timeout | Fire-and-forget — si falla, se loguea y se continúa | ✅ documentado en `AnalyticsEventsService` |
| `chatia-backend` | `notificaciones-backend` | ⚠️ pendiente definir | ⚠️ pendiente | pendiente |
| `workers-backend` | `chatia-backend` | ⚠️ pendiente definir | ⚠️ pendiente | pendiente |
| `workers-backend` | `analytics-backend` | ⚠️ pendiente definir | ⚠️ pendiente | pendiente |
| `pasarelapagos-backend` | (ninguno interno) | N/A | N/A | ✅ aislado |
| `notificaciones-backend` | `chatia-backend` (DLQ callback) | ⚠️ pendiente | ⚠️ pendiente | pendiente |

### Decisión documentada: chatia-backend → analytics-backend

`AnalyticsEventsService.track()` es fire-and-forget:
- `attempts: 1` (sin retry en BullMQ)
- Nunca lanza error al caller
- El tráfico operacional de chat nunca se degrada por un fallo de analytics
- Logging de warning si falla el enqueue

Este es el patrón correcto para datos best-effort (analítica).
Para datos críticos (pagos, notificaciones), el patrón es diferente.

---

## Cómo agregar un nuevo RPC

1. Editar `packages/proto/proto/<servicio>.proto`
2. Implementar en `<servicio>/src/grpc/<servicio>-grpc.controller.ts`
3. Actualizar `packages/grpc-client/src/<servicio>/<servicio>-grpc.module.ts`
4. Documentar en este archivo con timeout y fallback definidos
5. Nunca dejar un timeout "pendiente de definir" en producción

## Auditoría de controllers gRPC — lógica de negocio

| Controller | ¿Tiene lógica de negocio? | Acción requerida |
|---|---|---|
| `chatia-backend/src/grpc/` | ⚠️ verificar | Auditar manualmente |
| `pasarelapagos-backend/src/pagos/pagos.grpc.controller.ts` | ⚠️ verificar | Auditar manualmente |
| `notificaciones-backend/src/grpc/notificaciones-grpc.controller.ts` | ⚠️ verificar | Auditar manualmente |
| `analytics-backend/src/grpc/analytics-grpc.controller.ts` | ⚠️ verificar | Auditar manualmente |
| `workers-backend/src/grpc/workers-grpc.controller.ts` | ⚠️ verificar | Auditar manualmente |

**Regla:** un controller gRPC solo puede: recibir request proto → llamar al Service → retornar response proto.
Cero lógica condicional de negocio, cero imports de PrismaService, cero acceso a Redis.
