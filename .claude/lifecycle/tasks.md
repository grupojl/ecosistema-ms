# tasks.md — ecosistema-ms estado actual

**Última actualización:** 2026-10-01 — hardening cerrado

---

## COMPLETADO ✅ — Sesión 2026-10-01 (hardening)

### Imports
- [x] 63 imports relativos → `@/` (primera corrida)
- [x] 417 imports `@/` sin `.js` → con `.js`
- [x] marketing-backend src/ migrado completo
- [x] tests e2e con `.js` correcto
- [x] cero imports relativos en los 6 servicios
- [x] verify.sh: 56/56 ✅

### Observabilidad base
- [x] ZodExceptionFilter en los 6 servicios
- [x] LoggerModule (pino) en los 6 servicios
- [x] PrometheusModule en los 6 servicios
- [x] RequestIdMiddleware en los 6 servicios

### Circuit Breakers
- [x] CircuitBreakerService registrado en NotificationsModule
- [x] CircuitOpenError importado en AssistantChatService
- [x] try/catch CircuitOpenError en chat() con escalación a humano
- [x] GroqCbService inyectado en AssistantChatService

### CI/CD
- [x] .github/workflows/ci-chatia-backend.yml
- [x] .github/workflows/ci-pasarelapagos-backend.yml
- [x] .github/workflows/ci-notificaciones-backend.yml
- [x] .github/workflows/ci-analytics-backend.yml
- [x] .github/workflows/ci-workers-backend.yml
- [x] .github/workflows/ci-marketing-backend.yml
- [x] Cada workflow: lint + typecheck + test:cov + pnpm audit + Trivy + Cosign

### Documentación
- [x] CLAUDE.md actualizado (puntaje 8.5, fase 4)
- [x] AUDIT-LAST.md actualizado
- [x] lifecycle/03-fase-hardening.md cerrado

---

## COMPLETADO ✅ — Sesiones anteriores

### Sesión 2026-09-19
- [x] /health extendido en los 5 servicios originales
- [x] chatia-backend — adapters multimodales (6 adapters + MultimodalService)
- [x] InternalModule en chatia, pagos, workers

### Sesión 2026-09-12
- [x] Audit B tipado: 0 `any` sin marca en producción
- [x] marketing-backend implementado completo
- [x] ADR-019 project-strategy multi-servicio
- [x] ADR-021 reparación post-reestructura (typecheck/build 0 errores en 6 servicios)
- [x] ADR-020 packages consumen dist/ (auth-server, grpc-client, proto compilados; Dockerfiles + CI)

---

## PENDIENTE — Fase 4 Escala

### P0 — Inmediato
- [ ] Branch protection GitHub main (Settings → Branches → Require status checks: ci)
- [ ] `pnpm typecheck && pnpm build` → 0 errores
- [ ] DT-023: corregir getAgentMetrics — groupBy en DB, no take:50K

### P1 — Fase 4
- [ ] Health controller pasarela: SELECT 1 real a la DB
- [ ] RTO/RPO definidos por servicio (Escalón 9 — ver lifecycle/04-fase-escala.md)
- [ ] Backups Railway PostgreSQL verificados con restore real
- [ ] Redis AOF (appendonly yes) confirmado

### P2 — Fase 4
- [ ] Domain/Repository: contacts, agents, campaigns, notifications
- [ ] Tests cobertura 85% — pendiente para contexto de ecosistema
- [ ] Grafana dashboards conectados a /metrics
