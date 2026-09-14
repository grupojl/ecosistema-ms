# tasks.md — Checklist ejecutable ecosistema-ms

**Última actualización:** 2026-09-10

---

## S4 — En curso (bloqueante)

### Testing (P0)
- [ ] **S4-T01** Crear `ADR-011-testing-strategy-ms.md`
  - Criterio: define scope por ms, cómo mockear gRPC client, cobertura mínima 85%
- [ ] **S4-T02** Unit test: invariante multi-tenant `analytics.service.ts`
  - Criterio: test que llama `getConversationsByDay` sin `ecosystemId` y verifica que el where lo incluye
  - Criterio: test que verifica que datos de ecosistema A no aparecen en consulta de ecosistema B
  - Archivo: `analytics-backend/src/analytics/analytics.service.spec.ts`
- [ ] **S4-T03** Unit test: idempotencia BullMQ en workers-backend
  - Criterio: job ya procesado no se reprocesa
  - Archivo: `workers-backend/src/jobs/jobs.processor.spec.ts`
- [ ] **S4-T04** Integration test: `AnalyticsController`
  - Criterio: GET /analytics/overview con organizationId + ecosystemId → 200
  - Criterio: GET sin ecosystemId → 400 (si hay validación) o resultado scoped
  - Archivo: `analytics-backend/src/analytics/analytics.controller.spec.ts`
- [ ] **S4-T05** Fix tipo: `AgentMetric` interface
  - Criterio: `getAgentMetrics` retorna `{ agents: AgentMetric[]; total: number }` tipado
  - Archivo: `analytics-backend/src/analytics/analytics.service.ts`

### CI (P0)
- [ ] **S4-T06** `.github/workflows/ci.yml`
  - Criterio: `pnpm typecheck` + `pnpm test` por cada ms en cada PR
  - Criterio: matrix strategy: chatia | pasarela | notificaciones | analytics | workers

### OpenTelemetry (P2)
- [ ] **S4-T07** SDK básico en analytics-backend (primera referencia)
- [ ] **S4-T08** Correlación trace-id entre chatia → analytics

---

## Completado

- ✅ chatia-backend: conversaciones, agentes, canales, FAQ/RAG, asignación, AI config
- ✅ pasarelapagos-backend: pagos, providers, webhooks, retry
- ✅ notificaciones-backend: adaptadores email/push/SMS
- ✅ analytics-backend: eventos, proyecciones, SSE, gRPC
- ✅ workers-backend: BullMQ, DLQ, scheduler, circuit breaker
- ✅ packages/proto + grpc-client
- ✅ ADR-010: bug ecosystemId corregido
