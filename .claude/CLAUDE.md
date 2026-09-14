# ecosistema-ms — Contexto para Claude

**Fecha de última auditoría:** 2026-09-12
**Puntaje real (código auditado):** 7.6 / 10
**Puntaje proyectado (sesiones anteriores):** 8.3 — 9.1 ← DESINCRONIZADO

> El puntaje 8.3-9.1 de sesiones anteriores asumía que el x.sh corrió
> sobre los 5 servicios. En realidad corrió sobre 2 (chatia + pagos).
> El puntaje real auditado directamente en el código es 7.6.
> Ver .claude/AUDIT-LAST.md para el desglose completo.

---

## Stack

- NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- gRPC inter-servicio (@nestjs/microservices + @grpc/grpc-js)
- pnpm 10 workspaces con catalog único
- Deploy: Railway — 5 servicios separados, mismo repo

## Microservicios

| Servicio | HTTP | gRPC | Estado |
|----------|------|------|--------|
| chatia-backend | 3000 | 5001 | ZodFilter + pino ✅ |
| pasarelapagos-backend | 3001 | 5002 | ZodFilter + pino ✅ |
| notificaciones-backend | 3002 | 5003 | Sin ZodFilter ⚠️ |
| analytics-backend | 3003 | 5004 | Sin ZodFilter + DT-023 pendiente ⚠️ |
| workers-backend | 3004 | 5005 | Sin ZodFilter ⚠️ |

## Lo más sólido

- Multi-tenancy: ecosystemId + organizationId en todas las queries críticas
- Documentación .claude: ADR-001..009, checklists, reglas duras, lifecycle
- BullMQ: jobs idempotentes, DLQ en todos los servicios críticos
- Circuit breakers: opossum (chatia/pagos/notificaciones), Redis CB (workers)
- Lock distribuido: SET NX EX en analytics projections y workers campaigns

## Las brechas reales hoy

1. Domain/Repository: solo conversations y payments tienen el patrón completo
2. getAgentMetrics: take: 50_000 × 2 en Node — bomba de escala en analytics
3. 3 de 5 servicios sin ZodExceptionFilter (ZodError → HTTP 500)
4. app.module.ts de los 5 servicios sin LoggerModule ni PrometheusModule importados
5. Health controller de pasarela: sin SELECT 1 a la DB

## Próximas tareas (en orden de impacto)

1. Correr x.sh con los 5 servicios presentes en el checkout
2. Aplicar parche DT-023 (ver .claude/patches/DT-023-analytics-agent-metrics.md)
3. Refactorizar handleIncomingMessage en ConversationsService

## Regla antes de nueva sesión

Leer en orden: CLAUDE.md → AUDIT-LAST.md → decisions/ADR-009 → roadmap/deuda-tecnica.md
