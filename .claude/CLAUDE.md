# ecosistema-ms — Contexto para Claude

**Fecha de última auditoría:** 2026-10-01
**Puntaje real (código auditado):** 8.5 / 10
**Fase actual:** Fase 3 Hardening — CERRADA ✅ → Fase 4 Escala

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
- Documentación .claude: ADR-001..019, checklists, reglas duras, lifecycle
- BullMQ: jobs idempotentes, DLQ en todos los servicios críticos
- Circuit breakers: opossum (chatia/pagos/notificaciones) con CircuitOpenError capturado
- Lock distribuido: SET NX EX en analytics projections y workers campaigns
- Imports: 100% alias @/ con .js — cero imports relativos
- CI/CD: 6 workflows GitHub Actions con Trivy + Cosign + pnpm audit
- Observabilidad: LoggerModule + PrometheusModule + RequestIdMiddleware en los 6 servicios

## Brechas pendientes (Fase 4)

1. Domain/Repository: contacts, agents, campaigns, notifications sin patrón completo
2. getAgentMetrics: take: 50_000 × 2 en Node — bomba de escala en analytics (DT-023)
3. Health controller de pasarela: sin SELECT 1 real a la DB
4. Branch protection GitHub main — MANUAL pendiente
5. Tests: cobertura 85% pendiente para Fase 4+

## Reglas duras (nunca romper)

- `any` implícito o explícito sin marca → bug de diseño
- Import relativo (`../`, `./`) en src/ → usar `@/`
- `findMany` sin `ecosystemId` en where → bug de seguridad
- Lógica de negocio en controller o componente UI → bug de capa
- CircuitOpenError sin captura en paths de proveedores externos → PR bloqueado

## Próximas tareas (Fase 4 — Escala)

1. `pnpm typecheck && pnpm build` → 0 errores
2. Branch protection GitHub main
3. DT-023: corregir getAgentMetrics — groupBy en DB
4. Health controller pasarela: agregar SELECT 1 real
5. Domain/Repository: contacts, agents, campaigns, notifications
6. RTO/RPO definidos por servicio (Escalón 9)
