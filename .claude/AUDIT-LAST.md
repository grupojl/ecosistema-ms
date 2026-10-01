# AUDIT-LAST — ecosistema-ms

**Fecha:** 2026-10-01
**Auditor:** Claude (sesión hardening + x.sh)
**Puntaje real:** 8.5 / 10
**Puntaje anterior:** 7.6 / 10 (2026-09-12)
**Delta:** +0.9

---

## Puntaje por dimensión

| Dimensión            | Anterior | **Actual** | Δ     | Evidencia |
|----------------------|----------|------------|-------|-----------|
| Arquitectura/Capas   | 7.5      | **7.5**    | =     | Sin cambios — Domain/Repository parcial |
| Contratos/Tipado     | 7.5      | **9.0**    | +1.5  | ZodExceptionFilter en los 6 servicios. Audit B tipado cerrado (0 `any` sin marca) |
| Multi-tenancy        | 9.0      | **9.0**    | =     | Todas las queries críticas con ecosystemId + organizationId |
| Comunicación gRPC    | 7.5      | **7.5**    | =     | Sin cambios estructurales |
| Calidad de código    | 7.0      | **8.5**    | +1.5  | 0 `any` sin marca. 0 imports relativos. Imports @/ con .js |
| Base de datos        | 6.5      | **6.5**    | =     | getAgentMetrics take:50K sigue. Health pasarela sin SELECT 1 |
| Seguridad/RBAC       | 7.5      | **8.5**    | +1.0  | CI/CD con Trivy + pnpm audit. CircuitOpenError capturado |
| Config/Twelve-Factor | 8.5      | **9.5**    | +1.0  | LoggerModule + PrometheusModule + RequestIdMiddleware en 6 servicios |
| CI/CD                | 3.0      | **8.5**    | +5.5  | 6 workflows con lint + typecheck + test:cov + Trivy + Cosign |
| Documentación .claude| 9.5      | **9.5**    | =     | ADR-001..019, checklists, lifecycle actualizado |
| **PROMEDIO**         | **7.6**  | **8.5**    | **+0.9** | |

---

## Qué se hizo en la sesión 2026-10-01

### Imports (x.sh)
- 63 imports relativos → `@/` (primera corrida)
- 417 imports `@/` sin `.js` → con `.js`
- marketing-backend migrado completo
- tests e2e con `.js` correcto

### Hardening (x.sh)
- ZodExceptionFilter en los 6 servicios
- LoggerModule (pino) en los 6 servicios
- PrometheusModule en los 6 servicios
- RequestIdMiddleware en los 6 servicios
- CircuitBreakerService registrado en NotificationsModule
- CircuitOpenError + try/catch en AssistantChatService.chat() con escalación a humano
- 6 workflows GitHub Actions con Trivy + Cosign + pnpm audit

---

## Brechas que persisten

| ID | Brecha | Impacto | Fase |
|----|--------|---------|------|
| DT-023 | getAgentMetrics take:50K×2 | P0 escala | Fase 4 |
| DT-015 | Conversation sin ecosystemId directo | P1 | Fase 4 |
| B-HEALTH | Health pasarela sin SELECT 1 | P1 | Fase 4 |
| B-DOMAIN | Domain/Repository incompleto (contacts, agents, campaigns, notifications) | P2 | Fase 4 |
| B-BRANCH | Branch protection GitHub main | P0 manual | Inmediato |
