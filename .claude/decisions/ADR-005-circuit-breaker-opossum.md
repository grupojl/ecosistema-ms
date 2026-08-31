# ADR-005 — opossum como circuit breaker estandar del ecosistema

**Estado:** Implementado en todos los MS
**Fecha:** 2024-Q4

## Decision

`opossum` como implementacion estandar de circuit breaker en todo el ecosistema.
`CircuitBreakerService` es identico en los tres MS — solo cambian los parametros
de timeout/threshold por tipo de proveedor.

## Completado

- [x] `pasarelapagos-backend` — completo con `healthOf()`, `statsOf()`, integrado en RoutingService
- [x] `notificaciones-backend` — `circuit-breaker.service.ts` creado
  - [x] `EmailAdapter.send()` con CB key `'sendgrid'`
  - [x] `WhatsappAdapter.send()` con CB key `'whatsapp-biz-api'`
  - [x] `PushAdapter.send()` con CB key `'fcm'`
- [x] `chatia-backend` — `circuit-breaker.service.ts` en `common/services/`
  - [x] `GroqCbService` wrappea `GroqService` con CB key `'groq-llm'`
  - [x] `CircuitOpenError` tipado — el `AssistantChatService` lo captura y devuelve `fallbackMessage`

## Parametros por tipo de proveedor

| Proveedor | timeout | errorThreshold | resetTimeout |
|-----------|---------|----------------|--------------|
| Pasarela de pago | 5000ms | 50% | 30s |
| WhatsApp / Email | 8000ms | 40% | 60s |
| LLM (Groq) | 15000ms | 30% | 120s |
| FCM (push) | 5000ms | 50% | 30s |

## Pendiente

- [ ] `AssistantChatService` captura `CircuitOpenError` y devuelve `AssistantConfig.fallbackMessage`
  + escala a agente humano — este paso es logica de negocio en chatia, no infraestructura
- [ ] CB en canales salientes del `OutgoingMessageProcessor` de chatia (por `channelType`)
- [ ] `GET /health` incluye estado del CB de cada canal en los 3 MS
