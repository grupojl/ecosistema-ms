# Deuda técnica — ecosistema-ms

## Inventario por severidad

### 🔴 CRÍTICA — bloquea calidad de producción

| ID | Deuda | Servicio | ADR | Sprint |
|----|-------|----------|-----|--------|
| DT-001 | Todos los DTOs usan class-validator en vez de Zod | Todos | ADR-001 | FASE 2 |
| DT-002 | Ningún módulo tiene Domain/Repository — services hacen Prisma directo | Todos | ADR-002 | FASE 4 |
| DT-003 | `as unknown as` y `as any` en repositories (implícito por falta de toEntity) | Todos | ADR-002 | FASE 4 |
| DT-004 | Queries sin `ecosystemId` en el where (pendiente de auditar) | Todos | — | FASE 5 |

### 🟡 IMPORTANTE — genera riesgo a mediano plazo

| ID | Deuda | Servicio | Sprint |
|----|-------|----------|--------|
| DT-005 | `CircuitBreakerService` en `chatia-backend/common/` opera en memoria — con múltiples réplicas pierde estado | chatia-backend | FASE 5 |
| DT-006 | Controllers gRPC con lógica de negocio (pendiente de auditar) | Todos | FASE 3 |
| DT-007 | Timeouts y fallbacks de llamadas gRPC no documentados | Todos | FASE 3 |
| DT-008 | `pasarelapagos-backend` puede tener su propio firebase-auth duplicado de @ecosistema-ms/auth-server | pasarelapagos-backend | FASE 2 |

### 🔵 MEJORA — no urgente

| ID | Deuda | Servicio | Sprint |
|----|-------|----------|--------|
| DT-009 | Sin tests en ningún servicio | Todos | FASE 6 |
| DT-010 | CI no configurado (no hay `dependency-cruiser` ni ESLint rules de arquitectura) | Todos | FASE 6 |
| DT-011 | DTOs de jobs BullMQ (workers-backend) no son Zod — riesgo de deserialización incorrecta | workers-backend | FASE 2 |
