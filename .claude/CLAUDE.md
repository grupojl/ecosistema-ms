# ecosistema-ms — Contexto para Claude

**Fecha de última auditoría:** 2026-10-01
**Puntaje real (código auditado):** 8.5 / 10
**Fase actual:** Fase 3 Hardening — CERRADA ✅ → Fase 4 Escala
**Último hito (2026-10-08):** `pnpm typecheck && pnpm build` en 0 errores en los 6 servicios (ADR-020, ADR-021). El puntaje no se re-audita hasta correr tests y smoke test con DB/Redis reales.

---

## Stack

- NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- gRPC inter-servicio (@nestjs/microservices + @grpc/grpc-js)
- pnpm 10 workspaces con catalog único
- Deploy: Railway — 6 servicios separados, mismo repo

## Microservicios

| Servicio | HTTP | gRPC | Estado |
|----------|------|------|--------|
| chatia-backend | 3000 | 5001 | ✅ ZodFilter + pino + PrometheusModule + CB fallback |
| pasarelapagos-backend | 3001 | 5002 | ✅ ZodFilter + pino + PrometheusModule |
| notificaciones-backend | 3002 | 5003 | ✅ ZodFilter + pino + PrometheusModule + CBService |
| analytics-backend | 3003 | 5004 | ✅ ZodFilter + pino + PrometheusModule |
| workers-backend | 3004 | 5005 | ✅ ZodFilter + pino + PrometheusModule |
| marketing-backend | 3005 | 5006 | ✅ ZodFilter + pino + PrometheusModule |

## Lo más sólido

- Multi-tenancy: ecosystemId + organizationId en todas las queries críticas
- Documentación .claude: ADR-001..021, checklists, reglas duras, lifecycle
- BullMQ: jobs idempotentes, DLQ en todos los servicios críticos
- Circuit breakers: opossum (chatia/pagos/notificaciones) con CircuitOpenError capturado
- Lock distribuido: SET NX EX en analytics projections y workers campaigns
- Imports: 100% alias @/ con .js — cero imports relativos
- Packages compilan a `dist/` (tsc + tsc-alias); servicios consumen solo `dist/` — ADR-020
- CI/CD: 6 workflows GitHub Actions con Trivy + Cosign + pnpm audit
- Observabilidad: LoggerModule + PrometheusModule + RequestIdMiddleware en los 6 servicios

## Brechas pendientes (Fase 4)

1. Domain/Repository: agents, campaigns, notifications sin patrón completo
2. Tests: jest mal configurado en chatia/pasarela; nada ejecutado contra DB/Redis tras la reparación
3. Smoke test real: los 6 servicios arrancan (bootstrap Nest OK), falta DB/Redis reales e imágenes Docker
4. Branch protection GitHub main — MANUAL pendiente
5. Tests: cobertura 85% pendiente para Fase 4+

## Reglas duras (nunca romper)

- `any` implícito o explícito sin marca → bug de diseño
- Import relativo (`../`, `./`) en src/ → usar `@/`
- `findMany` sin `ecosystemId` en where → bug de seguridad
- Lógica de negocio en controller o componente UI → bug de capa
- CircuitOpenError sin captura en paths de proveedores externos → PR bloqueado
- Servicio que consume `src/` de un package (en vez de `dist/`) → bug de build (ADR-020)

## Próximas tareas (Fase 4 — Escala)

1. ✅ `pnpm typecheck && pnpm build` → 0 errores (2026-10-08). Cliente Prisma compartido: ver ADR-020 (addendum)
2. Branch protection GitHub main
3. ✅ DT-023 getAgentMetrics ya usa groupBy en DB
4. ✅ Health controller pasarela con SELECT 1 + PING Redis
5. Domain/Repository: agents, campaigns, notifications (contacts y conversations ✅)
6. **P0 post-reestructura:** tests (jest duplicado), smoke test con DB/Redis, imágenes Docker — ver `roadmap/deuda-tecnica.md`
7. RTO/RPO definidos por servicio (Escalón 9)
