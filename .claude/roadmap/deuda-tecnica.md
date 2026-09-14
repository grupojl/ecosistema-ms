# Deuda técnica — ecosistema-ms

**Última actualización:** 2026-09-02

## ✅ RESUELTOS — todo cerrado

| ID | Deuda | Cómo quedó |
|----|-------|------------|
| ~~DT-001~~ | dto/ huérfanas (17 carpetas) | Eliminadas |
| ~~DT-002~~ | class-validator inline (9 archivos) | Migrado a Zod — 0 imports residuales |
| ~~DT-003~~ | AllExceptionsFilter no registrado | Registrado en chatia + workers main.ts |
| ~~DT-004~~ | ConversationsService → PrismaService directo | Migrado a IConversationsRepository |
| ~~DT-005~~ | PaymentsService → PrismaService directo | PrismaService + IPaymentsRepository coexisten (ver nota) |
| ~~DT-006~~ | reconciliation.service sin tenantId en where | ConfigService + tenantId dentro del where |
| ~~DT-007~~ | contacts/ sin Domain/Repository | — (decidido: no aplicar, scope suficiente con organizationId) |
| ~~DT-008~~ | projects/ sin Domain/Repository | — (ídem, imports dto corregidos a schemas.ts) |
| ~~DT-009~~ | campaigns/ sin Domain/Repository | — (ídem) |
| ~~DT-011~~ | notifications.service getStats() sin ecosystemId | ecosystemId en StatsQuery + where |
| ~~DT-012~~ | analytics getConversationsByDay() sin ecosystemId | ecosystemId en firma + controller |
| ~~DT-013~~ | Timeouts gRPC no definidos | channelOptions/keepalive en 5 módulos grpc-client |
| ~~DT-014~~ | preferences.service getPreferences() sin ecosystemId | ecosystemId en where |
| ~~DT-016~~ | contacts.service import roto class-validator | Reescrito usando schemas.ts |
| ~~DT-017~~ | OrgContext sin tenantId | tenantId agregado a la interface |
| ~~DT-018~~ | projects.service imports dto legacy rotos | Migrado a schemas.ts (CreateProjectInput/UpdateProjectInput) |
| ~~DT-A~~ | Sin ZodValidationPipe ni filtros de excepción | Resuelto |
| ~~DT-B~~ | Controllers con class-validator | Resuelto |
| ~~DT-C~~ | class-validator en package.json | Resuelto |
| ~~DT-D~~ | conversations/ sin domain+repository | Resuelto |
| ~~DT-E~~ | payments/ sin domain+repository | Resuelto |
| ~~DT-F~~ | Sin contratos gRPC documentados | Resuelto |
| ~~DT-G~~ | Sin auditoría multi-tenant | Resuelto |

### Nota de arquitectura — DT-005

`PaymentsService` inyecta tanto `PrismaService` como `IPaymentsRepository`:
- `IPaymentsRepository` → lecturas simples: `findById`, `findByIdempotencyKey`, `list`
- `PrismaService` directamente → operaciones que requieren `$transaction` multi-tabla

---

## 🟡 PENDIENTE — decisión de arquitectura (no urgente)

| ID | Deuda | Archivo | Acción |
|----|-------|---------|--------|
| DT-015 | Modelo `Conversation` sin `ecosystemId` directo en schema | `chatia-backend/prisma/schema.prisma` | Evaluar migración antes de múltiples ecosistemas en prod |
| DT-010 | CircuitBreakerService en memoria | chatia + pasarelapagos | Migrar a Redis cuando se escale a múltiples instancias |

### DT-015 — cuándo hacerlo

El modelo `Conversation` llega a `ecosystemId` via join `Contact → Organization`.
Funciona correctamente con un ecosistema. Antes de tener 2+ ecosistemas con datos
reales en la misma DB, agregar:

```prisma
model Conversation {
  ecosystemId    String
  organizationId String
  @@index([ecosystemId, organizationId])
}
```

Luego: `pnpm --filter chatia-backend prisma migrate dev --name add-ecosystemId-conversation`

---

## 🔴 NUEVAS — ADR-008 (hacia 10/10)

| ID | Deuda | Servicio | Acción | Prioridad |
|----|-------|----------|--------|-----------|
| ~~DT-019~~ | Sin CI/CD pipeline por servicio | todos | `.github/workflows/ci-{servicio}.yml` | P0 |
| ~~DT-020~~ | Sin logs estructurados JSON en producción | todos | `pino` logger en `main.ts` | P0 |
| ~~DT-021~~ | Sin endpoint `/metrics` Prometheus | todos | `@willsoto/nestjs-prometheus` | P1 |
| ~~DT-022~~ | Sin propagación de `X-Request-Id` en gRPC | todos | metadata gRPC en grpc-client | P1 |
| ~~DT-023~~ | `getAgentMetrics` carga 100K rows en memoria | analytics | SQL aggregation con GROUP BY | P1 |
| DT-024 | `CircuitBreakerService` en memoria (multi-pod) | chatia · pagos | migrar a Redis (DT-010) | P2 |
| DT-025 | Sin tests de aislamiento multi-tenant | todos | `multitenant.spec.ts` por servicio | P1 |
| ~~DT-026~~ | `coverageThreshold` no configurado en jest | todos | `jest.config.ts` con 85% threshold | P0 |

---

## ADR-009 (hacia 9.5/10) — resueltas por x.sh

| ID | Deuda | Servicio | Estado |
|----|-------|----------|--------|
| ~~DT-027~~ | `main.ts` sin ZodExceptionFilter — ZodError sale como HTTP 500 | todos | ✅ x.sh |
| ~~DT-028~~ | packages/logger y metrics no importados en app.module.ts | todos | ✅ x.sh |
| ~~DT-029~~ | ConversationsService accede a `this.prisma` directo (viola ADR-002) | chatia | ✅ x.sh |
| ~~DT-023~~ | getAgentMetrics carga 100K rows en Node.js | analytics | ✅ x.sh |

---

## Auditoría 2026-09-12 — Brechas descubiertas (no estaban documentadas)

| ID | Deuda | Servicio | Severidad | Evidencia |
|----|-------|----------|-----------|-----------|
| DT-030 | ConversationsService.handleIncomingMessage usa this.prisma directo pese a IConversationsRepository inyectado | chatia | 🔴 | Viola ADR-002. Línea this.prisma.channelAccount.findUnique en el servicio |
| DT-031 | Health controller pasarela retorna status ok hardcodeado sin SELECT 1 | pasarela | 🔴 | Railway no detecta caída de DB. health.controller.ts línea 8519 |
| DT-032 | EmbeddingService genera embeddings via Groq chat prompt — no es un modelo de embeddings real | chatia | 🟡 | Sprint 4 pendiente. DIMENSIONS=384 es inventado |
| DT-033 | FaqIngestProcessor es stub explícito (TODO Sprint W-2) | workers | 🟡 | No procesa documentos reales. Solo loguea |
| DT-034 | status as any en campaigns.service.ts — enum cast sin tipo | workers | 🟡 | Línea 17070 — @ecosistema-ms/jsonb-cast comment ausente |
| DT-035 | app.module.ts de los 5 servicios sin LoggerModule ni PrometheusModule | todos | 🟡 | packages creados en ADR-008 pero nunca conectados |
| DT-036 | ZodExceptionFilter ausente en notificaciones, analytics y workers | 3 svcs | 🔴 | ZodError sale como HTTP 500 en esos servicios |
