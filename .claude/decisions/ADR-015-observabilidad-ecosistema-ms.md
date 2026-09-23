# ADR-015 — Observabilidad implementada — ecosistema-ms

**Fecha:** 2026-09-21
**Estado:** ✅ IMPLEMENTADO

## Qué se implementó

### packages/logger + packages/metrics (ya existían)
- [x] createLoggerModule() — pino con customProps: { service, requestId, ecosystemId }
- [x] createMetricsModule() — Prometheus con HTTP_REQUEST_DURATION, BULLMQ_JOB_DURATION, CIRCUIT_BREAKER_STATE

### Los 5 servicios (chatia, pasarela, notificaciones, analytics, workers)
- [x] LoggerModule en app.module.ts
- [x] PrometheusModule en app.module.ts
- [x] RequestIdMiddleware en configure() de cada AppModule
- [x] Health check extendido: DB + Redis + CircuitBreakers + DLQ depth + uptime + version

### packages/grpc-client (OBS-MS-01/02)
- [x] grpc-metadata.helper.ts: grpcMetadata() + extractRequestId()
  → Propaga x-request-id + x-ecosystem-id + x-organization-id en metadata gRPC
  → Backward compatible: grpcMetadata() sin args = Metadata vacío
  → Exportado desde @ecosistema-ms/grpc-client

### GitHub Actions
- [x] ci-packages.yml: typecheck auth-server + grpc-client + build logger + metrics

### catalog raíz (pnpm-workspace.yaml)
- [x] pino-pretty: "^13.0.0" (faltaba)
- [x] RequestIdMiddleware en pasarelapagos-backend (WARN resuelto)

## Pendiente consciente
- [ ] Adopción de grpcMetadata() en callers gRPC (próximo sprint)
- [ ] Branch protection en GitHub
- [ ] pnpm install para regenerar lockfile
