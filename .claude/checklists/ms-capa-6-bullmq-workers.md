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
