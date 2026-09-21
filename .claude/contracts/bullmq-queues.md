# Contratos BullMQ — Queues y Jobs

## Queues por microservicio

### chatia-backend
| Queue | Job | Productor | Consumidor |
|-------|-----|-----------|-----------|
| `incoming-messages` | `process-incoming` | webhooks externos | `IncomingMessageProcessor` |
| `outgoing-messages` | `send-message` | `ConversationsService` | `OutgoingMessageProcessor` |
| `faq-ingestion` | `ingest-document` | `FaqIngestionService` | `FaqIngestionProcessor` |

### analytics-backend
| Queue | Job | Productor | Consumidor |
|-------|-----|-----------|-----------|
| `analytics-events` | `persist-event` | otros microservicios | `AnalyticsEventProcessor` |
| `analytics-export` | `export-report` | `ExportService` | workers-backend |

### pasarelapagos-backend
| Queue | Job | Productor | Consumidor |
|-------|-----|-----------|-----------|
| `payments` | `reconcile` | `ReconciliationService` | `ReconcileProcessor` |
| `webhooks` | `process-webhook` | `WebhooksController` | `WebhookProcessor` |
| `dlq` | `dlq-item` | processors fallidos | `DlqProcessor` |

### notificaciones-backend
| Queue | Job | Productor | Consumidor |
|-------|-----|-----------|-----------|
| `notifications` | `send-notification` | otros microservicios | `NotificationProcessor` |

### workers-backend
| Queue | Job | Productor | Consumidor |
|-------|-----|-----------|-----------|
| `vector-index` | `index-document` | chatia-backend | `VectorIndexProcessor` |
| `campaign-email` | `send-campaign` | `CampaignsService` | `CampaignEmailProcessor` |
| `analytics-export` | `generate-export` | analytics-backend | `AnalyticsExportProcessor` |
| `faq-ingest` | `ingest-faq` | chatia-backend | `FaqIngestProcessor` |

## Convención de jobId determinista (pagos)
```typescript
// ✅ Idempotente — mismo pago siempre el mismo jobId
const jobId = `payment-reconcile:${paymentId}`;
await queue.add('reconcile', data, { jobId, removeOnComplete: true });
```

## DLQ policy
Jobs fallidos después de `maxAttempts` van a la queue `dlq` del microservicio.
`DlqMonitorService` alerta via notificaciones cuando el DLQ supera el umbral.

### marketing-backend
| Queue | Job | Productor | Consumidor |
|-------|-----|-----------|-----------| 
| `campaign-sync` | `sync-platform-metrics` | CronJob (cada 15 min, por org activa) | `SyncMetricsProcessor` |
| `campaign-automation` | `check-automation-rules` | CronJob (cada 1 hora) | `AutomationCheckProcessor` |
| `marketing-attribution` | `attribute-conversion` | `WebhookProcessor` en pasarelapagos (fire-forget cuando `newStatus === CAPTURED`) | `AttributeConversionProcessor` |

## Nota: queue cross-service (marketing-attribution)

`pasarelapagos-backend` produce jobs en la queue `marketing-attribution`
que consume `marketing-backend`. Ambos apuntan al mismo Redis.
El jobId es determinista para garantizar idempotencia:

```typescript
// pasarelapagos-backend/src/modules/payments/payments.service.ts
const jobId = `attribution:${paymentId}`; // mismo pago nunca se atribuye 2 veces
await this.attributionQueue.add('attribute-conversion', payload, {
  jobId,
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
});
```

Fire-and-forget obligatorio: el pago ya está confirmado antes de emitir.
Si la queue falla, el pago no revierte.

## Implementación real — marketing-attribution (2026-09-19)

El productor es `WebhookProcessor` en `pasarelapagos-backend`, no `PaymentsService`.
El pago se confirma via webhook del provider → `WebhookProcessor` transiciona a `CAPTURED`
→ fire-forget a `marketing-attribution`.

```typescript
// pasarelapagos-backend/src/modules/webhooks/webhook.processor.ts
// Archivo: src/common/constants/queues.ts
// export const QUEUE_MARKETING_ATTRIBUTION = 'marketing-attribution';
// export const JOB_ATTRIBUTE_CONVERSION    = 'attribute-conversion';

if (newStatus === PaymentStatus.CAPTURED) {
  this.marketingAttributionQueue
    .add(JOB_ATTRIBUTE_CONVERSION, { paymentId, ecosystemId, organizationId, revenue, currency, occurredAt },
      { jobId: `attribution:${payment.id}`, attempts: 3, backoff: { type: 'exponential', delay: 5_000 } })
    .catch(err => this.logger.warn(`[marketing-attribution] fire-forget failed: ${err.message}`));
  // NO await — pago ya confirmado, atribución best-effort
}
```

`QueueModule` es `@Global` → `QUEUE_MARKETING_ATTRIBUTION` disponible en `WebhookProcessor`
sin imports extra en `WebhooksModule`.
