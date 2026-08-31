# ADR-003 — BullMQ: jobs idempotentes, DLQ, lock distribuido

**Estado:** Implementado
**Fecha:** 2024-Q4

## Decision

Todos los jobs BullMQ criticos son idempotentes por diseno:
- `jobId` deterministico derivado de un ID estable de la entidad
- Verificacion de estado antes de ejecutar la operacion principal
- DLQ implementada en todos los MS criticos

## Completado

- [x] `jobId` deterministico en jobs de pago: `reconcile:${paymentId}`
- [x] `WebhookInbound.@@unique([providerId, externalId])` — idempotencia a nivel DB
- [x] DLQ implementada en pasarelapagos, notificaciones y workers
- [x] `DlqMonitorService` en notificaciones — alerta via gRPC cuando DLQ > 100
- [x] `AnalyticsEventsService`: `attempts: 1` fire-and-forget correcto
- [x] `JobLog` en workers-backend — trazabilidad con ecosystemId + organizationId
- [x] Lock distribuido CORRECTO en analytics projections (SET NX EX Redis)
- [x] Lock scheduler campaigns migrado a SET NX EX Redis (ADR-006 cerrado)
- [x] `CampaignRecipient` tabla creada — dispatcher usa recipients reales
- [x] `DlqModule` + `DlqController` en chatia para mensajes entrantes/salientes

## Regla permanente

Un job de pago o notificacion sin `jobId` deterministico no es idempotente.
No se aprueba en PR. El jobId debe derivarse de un ID estable — nunca de
`uuid()` o `Date.now()` en operaciones criticas.
