# Checklists por capa — ecosistema-ms

## Scores actuales (post cierre ADR-003/005/006/007)

| Capa | Archivo | Score | Referente | Cambio |
|------|---------|-------|-----------|--------|
| 1 — Auth / TenantGuard | ms-capa-1-auth-tenant.md | 8.5/10 | Auth0 / Clerk | = |
| 2 — Contratos HTTP / DTOs | ms-capa-2-contratos-http.md | 7.0/10 | startup escala | +0.5 |
| 3 — Logica de dominio | ms-capa-3-domain-service.md | 7.5/10 | B2B solido | +0.5 |
| 4 — Contratos gRPC | ms-capa-4-grpc-contratos.md | 8.2/10 | Google internal | = |
| 5 — Multi-tenant | ms-capa-5-multitenant.md | 8.0/10 | Shopify | = |
| 6 — BullMQ / Workers | ms-capa-6-bullmq-workers.md | 8.0/10 | Inngest | +0.8 |
| Testing | testing-desde-cero.md | 3.0/10 | sin tests | = |
| Observabilidad | observabilidad.md | 4.5/10 | logs parciales | = |

**Score promedio: 6.8/10** (sube desde 6.4)

## Proximas subidas de score de mayor impacto

1. **Pasos manuales S1** (capa 6: 8.0→8.5, capa 3: 7.5→8.0) — 6 tareas de bajo riesgo
2. **Testing Fase 1** (testing 3.0→6.0) — prerrequisito de confianza operacional
3. **toOutput() en services** (capa 3: 7.5→8.5, capa 2: 7.0→7.5)
4. **CB completo + observabilidad** (capa 3: +0.5, observabilidad 4.5→7.0)

## Como usar estos archivos

1. Al iniciar una sesion de trabajo: leer el checklist de la capa a trabajar
2. `- [x]` completado — no retroceder
3. `- [ ]` tarea concreta — elegir por prioridad
4. Marcados como **URGENTE** o **DT-00X** van primero
5. Marcados con S2/S3/S4 van al sprint correspondiente

## Indices rapidos

| Necesito... | Ir a... |
|-------------|---------|
| Saber que falta de los ADRs | `roadmap/deuda-tecnica.md` |
| Arrancar tests | `checklists/testing-desde-cero.md` |
| Agregar CB a un canal nuevo | `checklists/circuit-breaker-adapters.md` |
| Hacer deploy | `checklists/deploy-railway.md` |
| Nuevo modulo en un MS | `checklists/nuevo-modulo.md` |
| Cambiar un proto | `checklists/cambio-proto.md` |
