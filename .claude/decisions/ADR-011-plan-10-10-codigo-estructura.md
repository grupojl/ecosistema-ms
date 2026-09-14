# ADR-011 — Plan estructural para score 10/10 (sin observabilidad, testing ni deploy)

**Fecha:** 2026-09-10
**Estado:** Aceptado — en ejecución
**Repo:** grupojl/ecosistema-ms

## Gaps a cerrar (4)

- G1: class-validator en pasarela/workers + getAgentMetrics 100K rows en memoria
- G2: Domain/Repository incompleto (contacts, agents, campaigns, notifications)
- G3: CircuitBreaker sin capturar CircuitOpenError en AssistantChatService
- G4: toOutput() definido pero no conectado en services de negocio

## Sprints

### Sprint 1 — Zod completo + getAgentMetrics
- Migrar pasarelapagos-backend a Zod (CreatePaymentSchema, ListPaymentsSchema, RefundSchema)
- Migrar workers-backend a Zod (campaigns/dto, jobs/dto)
- Corregir getAgentMetrics: groupBy en DB, no cargar 100K rows

### Sprint 2 — Domain/Repository completo
- chatia-backend/contacts/ → domain/ + repository/
- chatia-backend/agents/ → domain/ + repository/
- workers-backend/campaigns/ → domain/ + repository/
- notificaciones-backend/notifications/ → domain/ + repository/

### Sprint 3 — Circuit Breaker en path crítico
- AssistantChatService: capturar CircuitOpenError → fallback + escalar humano
- OutgoingMessageProcessor: CB por channelType
- HealthExtendedController: incluir estado del CB por servicio

### Sprint 4 — toOutput() conectado
- conversations.service.ts: toOutput() en todos los métodos public
- contacts.service.ts: toOutput() en todos los métodos public
- Tipo de retorno declarado en payments.service.ts serialize()

## Verificación completa

```bash
./x.sh --check
```

## Reglas permanentes

- Un service public que devuelve tipo Prisma directo es bug de capa → PR bloqueado
- Un controller con class-validator es bug de arquitectura → PR bloqueado
- CircuitOpenError sin captura en paths de proveedores externos → PR bloqueado
- findMany sin ecosystemId en where → PR bloqueado
