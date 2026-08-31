# Checklist: Observabilidad — de 4.5 a 8.0/10

**Score actual: 4.5/10**
**Score objetivo: 8.0/10 — nivel Grafana stack / Datadog light**

## Que tiene el codigo HOY

- nestjs-pino instalado solo en pasarelapagos-backend
- @opentelemetry/sdk-node instalado solo en pasarelapagos-backend
- metrics.service.ts existe en analytics, workers y notificaciones pero sin exporter Prometheus real
- Sin correlationId que cruce llamadas gRPC
- DLQ monitor alerta via gRPC a chatia — no a infraestructura (Slack/PagerDuty)

## Fase 1 — Logging estructurado homogeneo (todos los MS)

- [ ] Agregar nestjs-pino + pino-http a chatia, analytics, notificaciones, workers
- [ ] main.ts de cada MS: app.useLogger(app.get(Logger)) de nestjs-pino
- [ ] JSON en produccion: transport: undefined cuando NODE_ENV=production
- [ ] Pretty print en dev: transport: { target: 'pino-pretty' }
- [ ] Campos obligatorios en cada log: { service, ecosystemId, organizationId, requestId }

## Fase 2 — correlationId cross-service

Objetivo: un request de welver -> chatia -> analytics -> workers tiene el mismo requestId.

- [ ] CorrelationIdInterceptor en @ecosistema-ms/auth-server
  — Lee x-request-id del header HTTP o genera UUID si no viene
  — Lo setea en AsyncLocalStorage
- [ ] gRPC: pasar x-request-id como metadata en packages/grpc-client (todos los modulos)
- [ ] BullMQ: pasar requestId en el payload del job
  { ...jobData, _requestId: correlationId }

## Fase 3 — Metricas Prometheus reales

Metricas minimas por MS:

chatia-backend:
- chatia_conversations_total{status}
- chatia_messages_total{direction,channel}
- chatia_ai_response_duration_seconds
- chatia_queue_depth{queue}

pasarelapagos-backend:
- pagos_payments_total{status,provider}
- pagos_provider_duration_seconds{provider}
- pagos_circuit_breaker_state{provider}  — 0=closed, 1=open, 2=half-open
- pagos_reconciliation_lag_seconds

notificaciones-backend:
- notif_sent_total{channel,status}
- notif_dlq_size (gauge)
- notif_dedup_hits_total

analytics-backend:
- analytics_events_ingested_total{event_type}
- analytics_sse_connections (gauge)
- analytics_projection_duration_seconds

workers-backend:
- workers_jobs_total{queue,status}
- workers_job_duration_seconds{queue}
- workers_dlq_size{queue} (gauge)
- workers_campaigns_dispatched_total

Acciones:
- [ ] @opentelemetry/exporter-prometheus en TODOS los MS (hoy solo pagos tiene la dep)
- [ ] GET /metrics retorna formato Prometheus text en todos los MS

## Fase 4 — Alertas

- [ ] notif_dlq_size > 50 -> Slack (hoy solo loguea)
- [ ] pagos_circuit_breaker_state{provider} == 1 por mas de 5 min -> PagerDuty
- [ ] chatia_ai_response_duration_seconds p95 > 10s -> Slack
- [ ] error rate HTTP > 1% en cualquier MS por mas de 2 min -> alerta

## Fase 5 — Tracing distribuido (S4)

- [ ] OpenTelemetry SDK en todos los MS (hoy solo pasarelapagos tiene la dep)
- [ ] @opentelemetry/auto-instrumentations-node: HTTP, gRPC, Prisma, BullMQ
- [ ] Exporter a Grafana Tempo o Jaeger
- [ ] Trace IDs propagados via gRPC metadata y BullMQ job payload
