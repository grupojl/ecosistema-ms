# Checklist: Circuit Breaker en adapters de canales

**Estado post cierre ADR-005:** implementado en notificaciones y chatia (Groq).
Quedan 3 pasos manuales para que sea funcional en produccion.

## Completado en codigo (confirmado en XML)

### notificaciones-backend
- [x] `circuit-breaker.service.ts` creado — mismo patron que pasarelapagos
- [x] `EmailAdapter.send()` envuelto con CB key `'sendgrid'`
      timeout:8000, errorThreshold:40, resetTimeout:60000
- [x] `WhatsappAdapter.send()` envuelto con CB key `'whatsapp-biz-api'`
- [x] `PushAdapter.send()` envuelto con CB key `'fcm'`
      timeout:5000, errorThreshold:50, resetTimeout:30000
- [x] `chatia-internal.interface.ts` — tipado gRPC correcto (elimina @ts-expect-error)

### chatia-backend
- [x] `circuit-breaker.service.ts` en `common/services/`
- [x] `groq-cb.service.ts` — wrappea GroqService con CB key `'groq-llm'`
      timeout:15000, errorThreshold:30, resetTimeout:120000
- [x] `CircuitOpenError` tipado y exportado — listo para capturar en AssistantChatService

## Pendiente (pasos manuales — ejecutar en orden)

### 1. Instalar opossum donde falta
```bash
pnpm add opossum --filter chatia-backend
pnpm add opossum --filter notificaciones-backend
# pasarelapagos ya tiene opossum@8.1.4
```

### 2. Registrar CircuitBreakerService en NotificationsModule
```typescript
// notificaciones-backend/src/notifications/notifications.module.ts
import { CircuitBreakerService } from './circuit-breaker.service.js';

@Module({
  providers: [
    NotificationsService,
    CircuitBreakerService,   // agregar
    EmailAdapter,
    WhatsappAdapter,
    PushAdapter,
    ...
  ],
})
export class NotificationsModule {}
```

### 3. AssistantChatService: capturar CircuitOpenError
```typescript
// chatia-backend/src/assistant/chat/assistant-chat.service.ts
import { GroqCbService, CircuitOpenError } from '../../groq/groq-cb.service.js';

// En el metodo chat():
try {
  const response = await this.groqCb.chat(messages, model, temperature);
  return { response, usedFaqFallback: false, ... };
} catch (err) {
  if (err instanceof CircuitOpenError) {
    // Groq caido — devolver fallback y escalar a humano
    await this.escalateToHuman(input.conversationId);
    return {
      response:        config.fallbackMessage ?? 'Servicio temporalmente no disponible.',
      usedFaqFallback: false,
      tokensUsed:      0,
      modelUsed:       'fallback',
    };
  }
  throw err;
}
```

## Proximos pasos (S2)

- [ ] CB en `OutgoingMessageProcessor` de chatia por `channelType`
- [ ] `GET /health` expone estado del CB en los 3 MS
- [ ] Metricas Prometheus: `notif_circuit_breaker_state{channel}` gauge (0/1/2)
