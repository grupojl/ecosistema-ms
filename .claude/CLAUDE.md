# ecosistema-ms — Contexto para Claude

**Fecha de última auditoría:** 2026-10-15 (chatia-backend)
**Puntaje chatia-backend (rúbrica audit-service, medido 2026-10-15):** 9.5 / 10 — los otros 5 servicios aún sin auditar con la rúbrica (la nota global previa, 8.5, no era comparable)
**Fase actual:** Fase 3 Hardening — CERRADA ✅ → Fase 4 Escala
**Último hito (2026-10-08):** `pnpm typecheck && pnpm build` en 0 errores en los 6 servicios (ADR-020, ADR-021). chatia ya se probó con Postgres y Redis reales (50 tests de integración, 2026-10-15).

---

## Stack

- NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- gRPC inter-servicio (@nestjs/microservices + @grpc/grpc-js)
- pnpm 10 workspaces con catalog único
- Deploy: Railway — 6 servicios separados, mismo repo

## Microservicios

| Servicio | HTTP | gRPC | Estado |
|----------|------|------|--------|
| chatia-backend | 3010 | 5010 | ✅ ZodFilter + pino + PrometheusModule + CB fallback |
| pasarelapagos-backend | 3011 | 5011 | ✅ ZodFilter + pino + PrometheusModule |
| notificaciones-backend | 3013 | 5013 | ✅ ZodFilter + pino + PrometheusModule + CBService |
| analytics-backend | 3012 | 5012 | ✅ ZodFilter + pino + PrometheusModule |
| workers-backend | 3014 | 5014 | ✅ ZodFilter + pino + PrometheusModule |
| marketing-backend | 3015 | 5015 | ✅ ZodFilter + pino + PrometheusModule |

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

1. Domain/Repository: campaigns y notifications sin patrón completo (agents ✅ en chatia; en chatia 19 services de `core/` aún usan Prisma directo — trinquete en `architecture.spec.ts`)
2. Tests: chatia ✅ (601 unit + 50 integración con Postgres/Redis reales, cobertura 92 %); pasarela y los otros 4 servicios sin ejecutar contra DB/Redis
3. Smoke test real: los 6 servicios arrancan (bootstrap Nest OK), falta DB/Redis reales e imágenes Docker
4. Branch protection GitHub main — MANUAL pendiente
5. Tests: cobertura 85% pendiente para Fase 4+

## Reglas duras (nunca romper)

- `jobId` de BullMQ **nunca con `:`** (usar `_`): BullMQ lo rechaza salvo 3 partes exactas. Corregido en los 6 servicios (2026-10-16); falta probarlo con Redis real — ver `roadmap/deuda-tecnica.md`

- `src/` solo tiene `core/`, `infrastructure/`, `modules/` (+ `main.ts`, `app.module.ts`, `generated/`) — ADR-022. `@Controller` solo en `modules/` (comunes en `modules/common/`, exclusivos en `modules/<eco>/`) o en `infrastructure/transport/`; nunca en `core/`. Lo fuerza `architecture.spec.ts` (chatia ya cumple; los otros 5 servicios pendientes)

- `any` implícito o explícito sin marca → bug de diseño
- Import relativo (`../`, `./`) en src/ → usar `@/`
- `findMany` sin `ecosystemId` en where → bug de seguridad
- Lógica de negocio en controller o componente UI → bug de capa
- CircuitOpenError sin captura en paths de proveedores externos → PR bloqueado
- Servicio que consume `src/` de un package (en vez de `dist/`) → bug de build (ADR-020)
- Importar de `@prisma/client` en un servicio → usar `@/generated/prisma/client.js` (cliente por servicio, ADR-020)

## Próximas tareas (Fase 4 — Escala)

1. ✅ `pnpm typecheck && pnpm build` → 0 errores (2026-10-08). Cliente Prisma compartido: ver ADR-020 (addendum)
2. Branch protection GitHub main
3. ✅ DT-023 getAgentMetrics ya usa groupBy en DB
4. ✅ Health controller pasarela con SELECT 1 + PING Redis
5. Domain/Repository: agents, campaigns, notifications (contacts y conversations ✅)
6. **P0 post-reestructura:** tests (jest duplicado), smoke test con DB/Redis, imágenes Docker — ver `roadmap/deuda-tecnica.md`
7. RTO/RPO definidos por servicio (Escalón 9)
8. WhatsApp multi-organización: app de plataforma (Tech Provider) + Embedded Signup, cada org paga su WABA — ver ADR-024 (norte; circuito probado en local 2026-10-20, falta endpoint de alta, pantalla en dashboard y app de Meta publicada)
