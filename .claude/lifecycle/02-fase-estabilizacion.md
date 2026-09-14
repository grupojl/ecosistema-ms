# Fase 2 — Estabilización (antes de producción multitenante)

## Objetivo

Que el sistema sea operable en producción con confianza.
No es sobre features nuevos — es sobre saber cuándo algo se rompe
y poder arreglarlo antes de que el cliente lo note.

## Escalones en esta fase

| # | Escalón | Estado | ADR |
|---|---------|--------|-----|
| 3 | Infraestructura y Red | ⚠️ Parcial | — |
| 5 | CI/CD y Despliegues | 🔴 En ejecución | ADR-008 |
| 6 | Observabilidad y Operaciones | 🔴 En ejecución | ADR-008 |

## Tareas concretas (en orden)

### CI/CD (Escalón 5)

- [x] `.github/workflows/ci-chatia.yml` — lint + typecheck + test + build
- [x] `.github/workflows/ci-pasarelapagos.yml`
- [x] `.github/workflows/ci-notificaciones.yml`
- [x] `.github/workflows/ci-analytics.yml`
- [x] `.github/workflows/ci-workers.yml`
- [ ] `.github/workflows/ci-packages.yml` — proto + auth-server + grpc-client
- [ ] Branch protection rules en GitHub (bloquear merge sin CI verde)
- [x] `jest.config.ts` con `coverageThreshold` en cada servicio

### Observabilidad (Escalón 6)

- [x] `packages/logger/` — `createPinoLogger()` compartido
- [x] `packages/metrics/` — `createPrometheusModule()` compartido
- [x] `X-Request-Id` middleware en cada servicio
- [ ] Propagación de requestId en metadata gRPC
- [x] `/metrics` endpoint en cada servicio
- [ ] Health check enriquecido (DB + Redis + BullMQ + CBs)
- [ ] Dashboard Grafana Cloud con métricas base

### Tests (Escalón 1 — completar)

- [ ] `jest.config.ts` base en `packages/` reutilizable
- [ ] Tests de dominio: `conversations`, `payments`
- [ ] Integration tests: contratos HTTP críticos (payments, conversations, auth)
- [ ] Suite multi-tenant: cross-ecosystem isolation test por servicio
- [ ] 85% cobertura enforceada en CI

## Criterio de salida de esta fase

- Todo PR en `main` pasa CI completo (lint + type + test + build)
- Todos los servicios tienen `/metrics` con al menos request_duration y errors
- Logs en JSON en producción con requestId trazable
- Health checks usados por Railway para restart automático
