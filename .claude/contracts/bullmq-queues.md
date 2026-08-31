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
