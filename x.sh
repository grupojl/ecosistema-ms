#!/usr/bin/env bash
# =============================================================================
# x.sh — Actualiza .claude/ con el estado real del repo post cierre ADR-003/005/007
# Marca [x] lo que el XML confirma que existe, deja [ ] lo que aun es manual.
# Ejecutar desde la raiz del monorepo: bash x.sh
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE="$ROOT/.claude"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[x.sh]${NC} $*"; }
info() { echo -e "${BLUE}[x.sh]${NC} $*"; }
warn() { echo -e "${YELLOW}[x.sh]${NC} $*"; }

write_file() {
  local relpath="$1"; local path="$CLAUDE/$1"; shift
  mkdir -p "$(dirname "$path")"
  cat > "$path"
  info "ESCRITO: $relpath"
}

log "Actualizando .claude/ con estado real post cierre ADR-003/005/007"
log "=================================================================="


# =============================================================================
# ADR-003 — estado final con tareas completadas y pendientes manuales
# =============================================================================
write_file "decisions/ADR-003-bullmq-jobs-idempotentes.md" << 'HEREDOC'
# ADR-003 — BullMQ: jobs idempotentes, DLQ, lock distribuido

**Estado:** Implementado — 4 pasos manuales pendientes de aplicar
**Fecha:** 2024-Q4

## Decision

Todos los jobs BullMQ criticos son idempotentes por diseno:
`jobId` deterministico, verificacion de estado, DLQ en todos los MS criticos.

## Completado en codigo (confirmado en XML)

- [x] `jobId` deterministico en pagos: `reconcile:${paymentId}`
- [x] `WebhookInbound.@@unique([providerId, externalId])` — idempotencia DB
- [x] DLQ implementada en pasarelapagos, notificaciones y workers
- [x] `DlqMonitorService` en notificaciones — alerta gRPC cuando DLQ > 100
- [x] `AnalyticsEventsService`: `attempts: 1`, fire-and-forget correcto
- [x] `JobLog` en workers-backend — trazabilidad con ecosystemId + organizationId
- [x] Lock distribuido CORRECTO en analytics projections (`SET NX EX` Redis)
- [x] `workers-backend/prisma/schema.prisma` — modelo `CampaignRecipient` agregado
- [x] `workers-backend/src/campaigns/campaigns.service.ts` — SET NX EX + recipients reales
- [x] `chatia-backend/src/queue/dlq/` — DlqService + DlqController + DlqModule creados

## Pendiente (pasos manuales)

- [ ] `cd workers-backend && pnpm prisma migrate dev --name add_campaign_recipient`
      Genera la migration SQL de CampaignRecipient en la DB real
- [ ] Conectar `DlqModule` en `chatia-backend/src/queue/queue.module.ts`
      Importar DlqModule para que el controller quede registrado en NestJS
- [ ] `CampaignEmailProcessor` en workers: leer recipients de la tabla CampaignRecipient
      El processor aun usa `recipientIds` del payload del job — conectar al nuevo campo

## Regla permanente

Un job de pago o notificacion sin `jobId` deterministico no es idempotente.
No se aprueba en PR. El jobId debe derivarse de un ID estable — nunca de
`uuid()` o `Date.now()` en operaciones criticas.
HEREDOC


# =============================================================================
# ADR-005 — estado final
# =============================================================================
write_file "decisions/ADR-005-circuit-breaker-opossum.md" << 'HEREDOC'
# ADR-005 — opossum como circuit breaker estandar del ecosistema

**Estado:** Implementado — 3 pasos manuales pendientes
**Fecha:** 2024-Q4

## Decision

`opossum` como estandar de CB. `CircuitBreakerService` identico en los 3 MS
— solo cambian timeout/threshold por tipo de proveedor.

## Completado en codigo (confirmado en XML)

- [x] `pasarelapagos-backend` — `circuit-breaker.service.ts` con `healthOf()`, `statsOf()`
      integrado en `RoutingService` — referencia canonica
- [x] `notificaciones-backend/src/notifications/circuit-breaker.service.ts` — creado
- [x] `notificaciones-backend` — `EmailAdapter.send()` con CB key `'sendgrid'`
- [x] `notificaciones-backend` — `WhatsappAdapter.send()` con CB key `'whatsapp-biz-api'`
- [x] `notificaciones-backend` — `PushAdapter.send()` con CB key `'fcm'`
- [x] `chatia-backend/src/common/services/circuit-breaker.service.ts` — creado
- [x] `chatia-backend/src/groq/groq-cb.service.ts` — wrappea GroqService con CB key `'groq-llm'`
      `CircuitOpenError` exportado — listo para capturar en AssistantChatService
- [x] `notificaciones-backend/src/notifications/dlq/chatia-internal.interface.ts`
      tipado correcto del cliente gRPC (elimina el `@ts-expect-error`)

## Pendiente (pasos manuales)

- [ ] `pnpm add opossum --filter chatia-backend`
      `pnpm add opossum --filter notificaciones-backend`
      (opossum ya esta en pasarelapagos — solo falta en los otros dos)
- [ ] `AssistantChatService`: capturar `CircuitOpenError` de `GroqCbService`
      y retornar `AssistantConfig.fallbackMessage` + escalar a agente humano
      ```typescript
      try {
        response = await this.groqCb.chat(messages, model, temperature);
      } catch (err) {
        if (err instanceof CircuitOpenError) {
          await this.escalateToHuman(conversationId);
          return { response: config.fallbackMessage, usedFaqFallback: false };
        }
        throw err;
      }
      ```
- [ ] Registrar `CircuitBreakerService` en `NotificationsModule` de notificaciones-backend
      Agregar al providers[] del modulo para que los adapters puedan inyectarlo
- [ ] CB en canales salientes del `OutgoingMessageProcessor` de chatia
      Un CB por `channelType` (`'whatsapp-send'`, `'instagram-send'`, etc.)

## Parametros canonicos por tipo de proveedor

| Proveedor | timeout | errorThreshold | resetTimeout |
|-----------|---------|----------------|--------------|
| Pasarela de pago | 5000ms | 50% | 30s |
| WhatsApp / Email | 8000ms | 40% | 60s |
| LLM (Groq) | 15000ms | 30% | 120s |
| FCM (push) | 5000ms | 50% | 30s |
| Canal saliente (WA, IG) | 10000ms | 40% | 60s |
HEREDOC


# =============================================================================
# ADR-006 — cerrado completamente
# =============================================================================
write_file "decisions/ADR-006-lock-distribuido-scheduler.md" << 'HEREDOC'
# ADR-006 — Lock distribuido en schedulers con cron

**Estado:** Implementado y cerrado
**Fecha:** 2024-Q4

## Decision

Todos los schedulers usan `SET NX EX` de Redis — no BullMQ como proxy.

## Completado en codigo (confirmado en XML)

- [x] `analytics-backend/src/analytics/projections/projections.service.ts`
      `SET NX EX` — lock correcto, era el patron de referencia
- [x] `workers-backend/src/campaigns/campaigns.service.ts`
      Migrado de lock BullMQ a `SET NX EX` Redis — race condition eliminada
      Lock key: `workers:scheduler:campaigns`, TTL: 55s, liberado en `finally`

## Patron canonico (copiar en schedulers futuros)

```typescript
const LOCK_KEY = 'workers:scheduler:{nombre}';
const LOCK_TTL = 55; // segundos — menos que el intervalo del cron

@Cron('* * * * *')
async myScheduler(): Promise<void> {
  const lock = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
  if (!lock) return; // otro pod tiene el lock

  try {
    // logica del scheduler
  } finally {
    await this.redis.del(LOCK_KEY).catch(() => {});
  }
}
```

## Sin pendientes — ADR cerrado
HEREDOC

# =============================================================================
# ADR-007 — estado final
# =============================================================================
write_file "decisions/ADR-007-tipos-explicitos.md" << 'HEREDOC'
# ADR-007 — Tipos explicitos: sin `as any`, toOutput() en services

**Estado:** Implementado parcialmente — conectar tipos en services pendiente
**Fecha:** 2024-Q4

## Decision

Sin capa repository, el equivalente de `toEntity()` de welver es `toOutput()`
en services + tipos de salida en `types/`. DTOs solo en `dto/`, nunca inline.

## Completado en codigo (confirmado en XML)

### DTOs extraidos de services/controllers
- [x] `chatia-backend/src/contacts/dto/update-contact.dto.ts` — contenido real (estaba vacio)
- [x] `chatia-backend/src/contacts/dto/list-contacts.dto.ts` — creado (estaba inline en service)
- [x] `chatia-backend/src/agents/dto/register-agent.dto.ts` — creado (estaba inline en controller)

### Tipos de salida creados
- [x] `chatia-backend/src/conversations/types/conversation.types.ts`
      `ConversationOutput`, `ConversationListOutput`
- [x] `chatia-backend/src/contacts/types/contact.types.ts`
      `ContactOutput`, `ContactStatsOutput`
- [x] `pasarelapagos-backend/src/modules/payments/types/payment.types.ts`
      `PaymentOutput`, `PaymentListOutput`, `RefundOutput`

### Fix tipado gRPC
- [x] `notificaciones-backend/src/notifications/dlq/chatia-internal.interface.ts`
      `ChatiaInternalGrpcClient` con `Observable<T>` — elimina el `@ts-expect-error`

## Pendiente (pasos manuales)

- [ ] `conversations.service.ts` — importar `ConversationOutput` de `types/`
      y agregar metodo `private toConversationOutput(row): ConversationOutput`
      Hoy retorna el tipo Prisma crudo al controller
- [ ] `contacts.service.ts` — importar `ContactOutput` y agregar `toContactOutput()`
      Eliminar la definicion duplicada de UpdateContactDto y ListContactsDto
      que aun puede quedar en el service (verificar con grep)
- [ ] `payments.service.ts` — conectar `PaymentOutput` al metodo `serialize()`
      que ya existe — solo tiparlo correctamente con el nuevo tipo
- [ ] `dlq-monitor.service.ts` — reemplazar `@ts-expect-error` por
      `ChatiaInternalGrpcClient` de `chatia-internal.interface.ts`
      ```typescript
      // Antes:
      // @ts-expect-error — rxjs interop
      await this.chatiaClient.notifySystem(req).toPromise();

      // Despues:
      await firstValueFrom(this.chatiaClient.notifySystem(req));
      ```
- [ ] Audit final de DTOs inline restantes:
      `grep -rn "export class.*Dto" */src/**/*.service.ts`
      `grep -rn "export class.*Dto" */src/**/*.controller.ts`
- [ ] Marcar todos los campos JSONB con `// @ecosistema-ms/jsonb-cast`
      Campos conocidos: `AuditLog.payload`, `Campaign.metadata` (si existe),
      `AssistantSession.history`, `AssistantSession.metadata`,
      `AgentState.context`, `ChannelAccount.extraConfig`

## Excepcion documentada

`// @ecosistema-ms/jsonb-cast` — unica excepcion aceptada para campos `Json` de Prisma.
Sin ese comentario, cualquier cast es bloqueante en code review.

## Diferencia con welver ADR-007

| welver | ecosistema-ms |
|--------|--------------|
| `toEntity()` en repositories | `toOutput()` en services |
| Excepcion `// @real/jsonb-cast` | Excepcion `// @ecosistema-ms/jsonb-cast` |
| 11 repositories migrados | Services de alta superficie — en progreso |
HEREDOC


# =============================================================================
# CHECKLISTS — actualizar [x]/[ ] con estado real del XML
# =============================================================================

write_file "checklists/ms-capa-3-domain-service.md" << 'HEREDOC'
# Capa 3 — Logica de dominio en services
# Checklist 10/10

**Score actual: 7.5/10** (sube desde 7.0 — DTOs y tipos de salida agregados)
**Score objetivo: 10/10 — nivel Stripe / Linear internos**

## Completado

- [x] Logica de negocio en services — controllers no tienen if/else de negocio
- [x] `AssignmentService` con estrategias round-robin y least-load separadas
- [x] `RoutingService` de pagos con seleccion de provider aislada
- [x] `ReconciliationService` aislado — solo BullMQ lo llama
- [x] `CircuitBreakerService` en pasarelapagos — logica de CB encapsulada
- [x] `CircuitBreakerService` en chatia — `common/services/circuit-breaker.service.ts`
- [x] `CircuitBreakerService` en notificaciones — `notifications/circuit-breaker.service.ts`
- [x] `IdempotencyHelper` en notificaciones — logica de dedup aislada
- [x] `PiiService` en pasarelapagos — cifrado encapsulado
- [x] `PaymentStateMachine` con `assertValidTransition()` — invariantes de estado
- [x] `AuditService` — append-only, nunca modifica registros
- [x] `GroqCbService` — wrappea GroqService con CB; `CircuitOpenError` tipado
- [x] DTOs en `dto/` separados de services (contacts, agents migrados)
- [x] Tipos de salida en `types/` (ConversationOutput, ContactOutput, PaymentOutput)

## Pendiente para 10/10

### Conectar toOutput() en services (S2)
- [ ] `conversations.service.ts` → importar `ConversationOutput` y agregar `toConversationOutput()`
- [ ] `contacts.service.ts` → importar `ContactOutput`, agregar `toContactOutput()`
      y eliminar clases duplicadas que puedan quedar inline
- [ ] `payments.service.ts` → tipar `serialize()` con `PaymentOutput`

### Fallback de LLM (S2 — depende de ADR-005 manual)
- [ ] `AssistantChatService` captura `CircuitOpenError` de `GroqCbService`
      → retorna `AssistantConfig.fallbackMessage` + escalacion a agente humano

### Tests de logica de dominio (S2)
- [ ] Unit tests de `AssignmentService` — round-robin y least-load
- [ ] Unit tests de `RoutingService.selectProvider()` — con CB abierto/cerrado
- [ ] Unit tests de `ReconciliationService.reconcileOne()` — skip si COMPLETED
- [ ] Unit tests de `PaymentStateMachine` — todas las transiciones
- [ ] Ver `checklists/testing-desde-cero.md` para roadmap completo

### Enforcement CI (S3)
- [ ] dependency-cruiser: `*.controller.ts` no importa `PrismaService`
- [ ] ESLint: clase con sufijo `Dto` fuera de `dto/` = warning bloqueante

## Regla dura

Un controller que contiene logica condicional de negocio es un bug de arquitectura.
La logica va al service. El tipo de retorno de un service publico nunca es el
tipo Prisma crudo — siempre pasa por `toOutput()`.
HEREDOC


write_file "checklists/ms-capa-6-bullmq-workers.md" << 'HEREDOC'
# Capa 6 — BullMQ: jobs idempotentes, DLQ, observabilidad
# Checklist 10/10

**Score actual: 8.0/10** (sube desde 7.2 — CampaignRecipient, lock real, DLQ chatia)
**Score objetivo: 10/10 — nivel Inngest / Temporal**

## Completado

- [x] Processors con `@OnWorkerEvent('failed')` y `@OnWorkerEvent('completed')`
- [x] `jobId` deterministico en jobs de pago: `reconcile:${paymentId}`
- [x] `jobId` deterministico en campaigns: `campaign:${campaignId}`
- [x] `WebhookInbound.@@unique([providerId, externalId])` — idempotencia DB
- [x] DLQ en pasarelapagos, notificaciones y workers
- [x] `DlqMonitorService` en notificaciones — alerta via gRPC cuando DLQ > 100
- [x] `AnalyticsEventsService`: `attempts: 1` fire-and-forget correcto
- [x] `JobLog` en workers-backend — trazabilidad con ecosystemId + organizationId
- [x] Lock distribuido `SET NX EX` en analytics projections (referencia)
- [x] Lock distribuido `SET NX EX` en campaigns scheduler (ADR-006 cerrado)
- [x] `CampaignRecipient` tabla en schema.prisma — dispatcher usa recipients reales
- [x] `chatia-backend/src/queue/dlq/` — DlqService + DlqController + DlqModule

## Pendiente para 10/10

### Pasos manuales urgentes
- [ ] `cd workers-backend && pnpm prisma migrate dev --name add_campaign_recipient`
- [ ] Conectar `DlqModule` en `chatia-backend/src/queue/queue.module.ts`
- [ ] `CampaignEmailProcessor`: leer recipients de la tabla en lugar del payload

### DLQ en canales salientes de chatia (S2)
- [ ] CB en `OutgoingMessageProcessor` — un CB por `channelType`
      `'whatsapp-send'`, `'instagram-send'`, `'messenger-send'`, `'tiktok-send'`

### Tests de idempotencia (S2)
- [ ] Test: mismo `jobId` encolado dos veces → segunda ignorada por BullMQ
- [ ] Test: `NotificationProcessor` con mismo `idempotencyKey` → SKIPPED
- [ ] Test: `ReconcileProcessor` con pago ya COMPLETED → early return
- [ ] Test: scheduler de campaigns con lock activo → no dispatcha

### Enforcement CI (S3)
- [ ] Lint: `queue.add(name, data)` sin `jobId` en queues criticas = warning
      (criticas: payments, notifications, campaigns)

## Regla dura

Un job de pago o notificacion sin `jobId` deterministico no es idempotente.
Un scheduler sin `SET NX EX` tiene race condition en multi-pod.
Ninguna de las dos cosas se aprueba en PR.
HEREDOC


write_file "checklists/circuit-breaker-adapters.md" << 'HEREDOC'
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
HEREDOC


# =============================================================================
# ROADMAP — deuda tecnica actualizada post cierre ADRs
# =============================================================================
write_file "roadmap/deuda-tecnica.md" << 'HEREDOC'
# Deuda tecnica — lista viva (post cierre ADR-003/005/006/007)

Actualizar este archivo cada vez que se resuelve o agrega deuda.

## CRITICA — bloquea produccion confiable

### DT-001: 0 tests en todo el repositorio
Impacto: cualquier deploy es una apuesta.
Accion: ver `checklists/testing-desde-cero.md` — Fase 1 en el proximo sprint.
Archivos prioritarios: `routing.service.spec.ts`, `notification.processor.spec.ts`

### DT-002: Sin observabilidad cross-service
`nestjs-pino` solo en pasarelapagos. Sin correlationId. Sin metricas Prometheus reales.
Impacto: bugs en produccion tardan horas en diagnosticar.
Accion: ver `checklists/observabilidad.md` — Fase 1 y 2.

### DT-003: CampaignRecipient — migration pendiente de aplicar
Schema creado en codigo. La migration SQL no existe aun en la DB.
```bash
cd workers-backend && pnpm prisma migrate dev --name add_campaign_recipient
```
Hasta que corra, `CampaignRecipient` no existe en la DB real.

### DT-004a: opossum no instalado en chatia y notificaciones
El codigo usa `opossum` pero el package no esta en las deps de esos MS.
```bash
pnpm add opossum --filter chatia-backend
pnpm add opossum --filter notificaciones-backend
```
Sin esto, el build falla al arrancar.

### DT-004b: CircuitBreakerService no registrado en NotificationsModule
El servicio existe pero no esta en el providers[] del modulo — NestJS no lo inyecta.
Ver `checklists/circuit-breaker-adapters.md` paso 2.

### DT-004c: AssistantChatService sin captura de CircuitOpenError
`GroqCbService` lanza `CircuitOpenError` cuando Groq cae pero el caller
no lo captura — la excepcion llega al usuario como 500.
Ver `checklists/circuit-breaker-adapters.md` paso 3.

## ALTA — afecta estabilidad en escala

### DT-005: CERRADO — lock scheduler migrado a SET NX EX
`workers-backend/src/campaigns/campaigns.service.ts` usa `SET NX EX` Redis.
ADR-006 cerrado.

### DT-006: TenantGuard no auditado en todos los controllers
Sin evidencia de audit completo. Potencial data leak cross-tenant.
```bash
grep -rL "TenantGuard" */src/**/*.controller.ts
```

### DT-007: accessToken de ChannelAccount en texto plano en DB
`chatia-backend/prisma/schema.prisma`: `accessToken String` sin cifrar.
Los tokens de WhatsApp/IG deberian estar cifrados at-rest como el PII de pagos.

### DT-008: RESUELTO en codigo — @ts-expect-error eliminado por interface
`notificaciones-backend/src/notifications/dlq/chatia-internal.interface.ts`
provee el tipado correcto. Falta conectarlo en `dlq-monitor.service.ts`:
```typescript
// Reemplazar en dlq-monitor.service.ts:
// @ts-expect-error — rxjs interop
await this.chatiaClient.notifySystem(req).toPromise();

// Por:
await firstValueFrom(this.chatiaClient.notifySystem(req));
```

### DT-009: RESUELTO — DTOs extraidos de services
`contacts/dto/` y `agents/dto/` creados. Verificar con audit:
```bash
grep -rn "export class.*Dto" */src/**/*.service.ts
grep -rn "export class.*Dto" */src/**/*.controller.ts
```

### DT-010: Queries de conversations sin ecosystemId directo
`Conversation` no tiene `ecosystemId` directo — se accede via joins.
Auditar `conversations.service.ts` con `include` explicito.

## MEDIA — mantenibilidad

### DT-011: AnalyticsModule deprecated en chatia pendiente de eliminar
Confirmar con welver que no hay consumidores activos → eliminar el modulo.

### DT-012: Sin coverageThreshold en jest config
Agregar en todos los `package.json`:
```json
"coverageThreshold": { "global": { "lines": 85 } }
```

### DT-013: start:migrate en chatia sin node dist/main.js
```json
"start:migrate": "prisma migrate deploy"
```
Debe ser: `"prisma migrate deploy && node dist/main.js"`

### DT-014 (nuevo): toOutput() pendiente de conectar en services
Los tipos existen en `types/` pero los services aun no los usan.
Ver ADR-007 pendientes.

### DT-015 (nuevo): DlqModule no conectado en queue.module.ts de chatia
El modulo existe pero no esta importado en `queue.module.ts`.
HEREDOC


# =============================================================================
# ROADMAP/SPRINTS — reordenados con prioridades post cierre ADRs
# =============================================================================
write_file "roadmap/sprints.md" << 'HEREDOC'
# Sprints — ecosistema-ms (post cierre ADR-003/005/006/007)

## Estado actual del repo

5 microservicios con codigo de produccion funcional.
ADR-003, ADR-005, ADR-006 cerrados en codigo — 4 pasos manuales pendientes.
ADR-007 parcialmente conectado — tipos creados, services sin conectar.
0 tests en todo el repo.

## Sprint actual — S1: Completar pasos manuales de los ADRs cerrados

Estas 6 tareas son de bajo riesgo y alto impacto — desbloquean lo que ya esta codificado:

- [ ] `pnpm add opossum --filter chatia-backend --filter notificaciones-backend` (DT-004a)
- [ ] `cd workers-backend && pnpm prisma migrate dev --name add_campaign_recipient` (DT-003)
- [ ] Conectar `DlqModule` en `chatia-backend/src/queue/queue.module.ts` (DT-015)
- [ ] Registrar `CircuitBreakerService` en `NotificationsModule` (DT-004b)
- [ ] `AssistantChatService` captura `CircuitOpenError` → fallback (DT-004c)
- [ ] `dlq-monitor.service.ts` reemplaza `@ts-expect-error` por `firstValueFrom` (DT-008)

Adicionalmente en S1:
- [ ] Fix `start:migrate` en chatia: `prisma migrate deploy && node dist/main.js` (DT-013)
- [ ] Eliminar `AnalyticsModule` deprecated de chatia (DT-011)
- [ ] Audit TenantGuard: `grep -rL "TenantGuard" */src/**/*.controller.ts` (DT-006)

## S2: Conectar toOutput() + Testing Fase 1

### toOutput() en services (ADR-007 cierre final)
- [ ] `conversations.service.ts` — `toConversationOutput()` + importar `ConversationOutput`
- [ ] `contacts.service.ts` — `toContactOutput()` + eliminar clases inline
- [ ] `payments.service.ts` — tipar `serialize()` con `PaymentOutput`
- [ ] Audit final: `grep -rn "export class.*Dto" */src/**/*.service.ts`
- [ ] Marcar JSONB con `// @ecosistema-ms/jsonb-cast`

### Testing Fase 1 — de 3.0 a 6.0 (ver checklist completo)
Prioridad por impacto economico:
1. `routing.service.spec.ts` + `circuit-breaker.service.spec.ts` (pagos)
2. `notification.processor.spec.ts` + `idempotency.helper.spec.ts`
3. `assistant-chat.service.spec.ts` + `assignment.service.spec.ts`
4. `projections.service.spec.ts` + `campaigns.service.spec.ts`

## S3: CB completo + Observabilidad basica

- [ ] CB en `OutgoingMessageProcessor` de chatia por channelType
- [ ] `nestjs-pino` en chatia, analytics, notificaciones, workers
- [ ] `correlationId` cross-service en `@ecosistema-ms/auth-server`
- [ ] Metricas Prometheus reales en todos los MS
- [ ] `accessToken` de ChannelAccount cifrado at-rest (DT-007)
- [ ] Integration tests Supertest para contratos HTTP criticos

## S4: Testing 85% + Observabilidad completa

- [ ] `coverageThreshold: { lines: 85 }` en jest config de todos los MS
- [ ] GitHub Actions: bloquear PR si cobertura baja del 85%
- [ ] OpenTelemetry tracing distribuido
- [ ] Dashboard Grafana con metricas unificadas
- [ ] Alertas: DLQ, CB state, error rate, latencia LLM

## S5: Hardening

- [ ] mTLS entre microservicios en Railway
- [ ] Versioning semantico de protos
- [ ] Load testing de payments con k6
HEREDOC


# =============================================================================
# CHECKLISTS/README — tabla de scores actualizada
# =============================================================================
write_file "checklists/README.md" << 'HEREDOC'
# Checklists por capa — ecosistema-ms

## Scores actuales (post cierre ADR-003/005/006/007)

| Capa | Archivo | Score | Referente | Cambio |
|------|---------|-------|-----------|--------|
| 1 — Auth / TenantGuard | ms-capa-1-auth-tenant.md | 8.5/10 | Auth0 / Clerk | = |
| 2 — Contratos HTTP / DTOs | ms-capa-2-contratos-http.md | 7.0/10 | startup escala | +0.5 |
| 3 — Logica de dominio | ms-capa-3-domain-service.md | 7.5/10 | B2B solido | +0.5 |
| 4 — Contratos gRPC | ms-capa-4-grpc-contratos.md | 8.2/10 | Google internal | = |
| 5 — Multi-tenant | ms-capa-5-multitenant.md | 8.0/10 | Shopify | = |
| 6 — BullMQ / Workers | ms-capa-6-bullmq-workers.md | 8.0/10 | Inngest | +0.8 |
| Testing | testing-desde-cero.md | 3.0/10 | sin tests | = |
| Observabilidad | observabilidad.md | 4.5/10 | logs parciales | = |

**Score promedio: 6.8/10** (sube desde 6.4)

## Proximas subidas de score de mayor impacto

1. **Pasos manuales S1** (capa 6: 8.0→8.5, capa 3: 7.5→8.0) — 6 tareas de bajo riesgo
2. **Testing Fase 1** (testing 3.0→6.0) — prerrequisito de confianza operacional
3. **toOutput() en services** (capa 3: 7.5→8.5, capa 2: 7.0→7.5)
4. **CB completo + observabilidad** (capa 3: +0.5, observabilidad 4.5→7.0)

## Como usar estos archivos

1. Al iniciar una sesion de trabajo: leer el checklist de la capa a trabajar
2. `- [x]` completado — no retroceder
3. `- [ ]` tarea concreta — elegir por prioridad
4. Marcados como **URGENTE** o **DT-00X** van primero
5. Marcados con S2/S3/S4 van al sprint correspondiente

## Indices rapidos

| Necesito... | Ir a... |
|-------------|---------|
| Saber que falta de los ADRs | `roadmap/deuda-tecnica.md` |
| Arrancar tests | `checklists/testing-desde-cero.md` |
| Agregar CB a un canal nuevo | `checklists/circuit-breaker-adapters.md` |
| Hacer deploy | `checklists/deploy-railway.md` |
| Nuevo modulo en un MS | `checklists/nuevo-modulo.md` |
| Cambiar un proto | `checklists/cambio-proto.md` |
HEREDOC

# =============================================================================
# RESUMEN
# =============================================================================
echo ""
log "=================================================================="
log ".claude/ actualizado con estado real del repo"
echo ""
info "Archivos escritos:"
info "  decisions/ADR-003-bullmq-jobs-idempotentes.md"
info "  decisions/ADR-005-circuit-breaker-opossum.md"
info "  decisions/ADR-006-lock-distribuido-scheduler.md"
info "  decisions/ADR-007-tipos-explicitos.md"
info "  checklists/ms-capa-3-domain-service.md  (score 7.0 -> 7.5)"
info "  checklists/ms-capa-6-bullmq-workers.md  (score 7.2 -> 8.0)"
info "  checklists/circuit-breaker-adapters.md  (estado post ADR-005)"
info "  checklists/README.md                    (scores actualizados)"
info "  roadmap/deuda-tecnica.md                (15 DTs, estado real)"
info "  roadmap/sprints.md                      (S1 con 6 tareas manuales)"
echo ""
warn "Los 6 pasos manuales del S1 NO estan en este script — requieren"
warn "ejecucion en el repo con acceso a la DB y pnpm real:"
warn "  1. pnpm add opossum --filter chatia-backend --filter notificaciones-backend"
warn "  2. cd workers-backend && pnpm prisma migrate dev --name add_campaign_recipient"
warn "  3. Conectar DlqModule en chatia-backend/src/queue/queue.module.ts"
warn "  4. Registrar CircuitBreakerService en NotificationsModule"
warn "  5. AssistantChatService: capturar CircuitOpenError"
warn "  6. dlq-monitor.service.ts: firstValueFrom en lugar de @ts-expect-error"
echo ""
log "  git add .claude/ && git commit -m 'docs: .claude/ actualizado post cierre ADR-003/005/006/007'"
log "=================================================================="