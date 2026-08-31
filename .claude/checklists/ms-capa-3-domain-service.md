# Capa 3 — Logica de dominio en services
# Checklist 10/10

**Score actual: 7.5/10** (sube desde 7.0 — DTOs y tipos de salida agregados)
**Score objetivo: 10/10 — nivel Stripe / Linear internos**

## Completado

- [x] Logica de negocio en services — controllers no tienen if/else de negocio
- [x] `AssignmentService` con estrategias round-robin y least-load separadas
- [x] `RoutingService` de pagos con seleccion de provider aislada
- [x] `ReconciliationService` aislado — solo BullMQ lo llama
- [x] `CircuitBreakerService` en pasarelapagos — logica de CB encapsulada
- [x] `CircuitBreakerService` en chatia — `common/services/circuit-breaker.service.ts`
- [x] `CircuitBreakerService` en notificaciones — `notifications/circuit-breaker.service.ts`
- [x] `IdempotencyHelper` en notificaciones — logica de dedup aislada
- [x] `PiiService` en pasarelapagos — cifrado encapsulado
- [x] `PaymentStateMachine` con `assertValidTransition()` — invariantes de estado
- [x] `AuditService` — append-only, nunca modifica registros
- [x] `GroqCbService` — wrappea GroqService con CB; `CircuitOpenError` tipado
- [x] DTOs en `dto/` separados de services (contacts, agents migrados)
- [x] Tipos de salida en `types/` (ConversationOutput, ContactOutput, PaymentOutput)

## Pendiente para 10/10

### Conectar toOutput() en services (S2)
- [ ] `conversations.service.ts` → importar `ConversationOutput` y agregar `toConversationOutput()`
- [ ] `contacts.service.ts` → importar `ContactOutput`, agregar `toContactOutput()`
      y eliminar clases duplicadas que puedan quedar inline
- [ ] `payments.service.ts` → tipar `serialize()` con `PaymentOutput`

### Fallback de LLM (S2 — depende de ADR-005 manual)
- [ ] `AssistantChatService` captura `CircuitOpenError` de `GroqCbService`
      → retorna `AssistantConfig.fallbackMessage` + escalacion a agente humano

### Tests de logica de dominio (S2)
- [ ] Unit tests de `AssignmentService` — round-robin y least-load
- [ ] Unit tests de `RoutingService.selectProvider()` — con CB abierto/cerrado
- [ ] Unit tests de `ReconciliationService.reconcileOne()` — skip si COMPLETED
- [ ] Unit tests de `PaymentStateMachine` — todas las transiciones
- [ ] Ver `checklists/testing-desde-cero.md` para roadmap completo

### Enforcement CI (S3)
- [ ] dependency-cruiser: `*.controller.ts` no importa `PrismaService`
- [ ] ESLint: clase con sufijo `Dto` fuera de `dto/` = warning bloqueante

## Regla dura

Un controller que contiene logica condicional de negocio es un bug de arquitectura.
La logica va al service. El tipo de retorno de un service publico nunca es el
tipo Prisma crudo — siempre pasa por `toOutput()`.
