# Checklist — Observabilidad por microservicio

## Nivel 1 — Mínimo viable (antes de producción)

### Logs estructurados
- [ ] `pino` instalado en el servicio
- [ ] `main.ts` usa `createPinoLogger()` de `packages/logger`
- [ ] En producción (`NODE_ENV=production`): JSON sin colores
- [ ] En local: `pino-pretty` con colores
- [ ] Todo log incluye: `service`, `requestId`, `ecosystemId` (cuando aplica)

### Request ID
- [ ] `RequestIdMiddleware` aplicado globalmente en `app.module.ts`
- [ ] `X-Request-Id` se lee del header entrante o se genera UUID v4
- [ ] El requestId se propaga al AsyncLocalStorage disponible en el service
- [ ] Los clientes gRPC incluyen `x-request-id` en el metadata del call

### Health check
- [ ] `GET /health` retorna 200 cuando todo está ok, 503 cuando algo falla
- [ ] Incluye: estado de DB (Prisma), Redis, BullMQ queues (si aplica)
- [ ] Incluye: estado de circuit breakers por key
- [ ] Railway usa este endpoint como health check del servicio

## Nivel 2 — Métricas Prometheus

- [ ] `@willsoto/nestjs-prometheus` instalado
- [ ] `PrometheusModule` en `app.module.ts`
- [ ] Endpoint `/metrics` registrado (solo accesible desde red interna Railway)
- [ ] Métricas base configuradas:
  - [ ] `http_request_duration_seconds` (histogram por ruta y método)
  - [ ] `http_requests_total` (counter por ruta, método y status)
  - [ ] `bullmq_job_duration_seconds` (por queue y tipo de job)
  - [ ] `bullmq_job_failures_total` (por queue)
- [ ] Métricas de negocio (al menos una por servicio):
  - chatia: `conversations_created_total`, `messages_processed_total`
  - pagos: `payments_created_total`, `payment_provider_calls_total`
  - analytics: `events_persisted_total`, `projections_duration_seconds`
  - notificaciones: `notifications_sent_total`, `notifications_failed_total`
  - workers: `jobs_processed_total`, `campaign_recipients_dispatched_total`
- [ ] Circuit breaker state como gauge: `circuit_breaker_state{key, service}`

## Nivel 3 — Dashboard

- [ ] Grafana Cloud conectado al endpoint `/metrics` de cada servicio
- [ ] Dashboard base con: request rate, error rate, latency p50/p95/p99
- [ ] Alert: error rate > 5% en 5 min → alerta Slack/email
- [ ] Alert: circuit breaker OPEN → alerta inmediata

## Comando de verificación rápida

```bash
# Verificar que /metrics responde en cada servicio
for port in 3000 3001 3002 3003 3004; do
  echo "=== Puerto $port ===" && curl -s http://localhost:$port/metrics | head -5
done

# Verificar /health
for port in 3000 3001 3002 3003 3004; do
  echo "=== /health :$port ===" && curl -s http://localhost:$port/health | jq .
done
```
