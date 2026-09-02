# Sprints — ecosistema-ms

## Orden de prioridad (derivado del roadmap de brechas)

### FASE 0 — Estructura base .claude/ ✅ COMPLETADO
Ejecutar `x.sh` — crea toda la estructura.

### FASE 1 — Clasificar carpetas bloqueantes/dinámicas ✅ COMPLETADO
Incluido en los archivos `services/<servicio>.md` generados por `x.sh`.

### FASE 2 — ADR-001: DTOs → Zod (BLOQUEANTE)
**Estado:** Pendiente — es el primer sprint de código
**Qué hacer:**
1. Crear `ZodValidationPipe` + `ZodExceptionFilter` en cada servicio
2. Migrar todos los DTOs de chatia-backend (~20 DTOs)
3. Migrar DTOs de pasarelapagos-backend (2 DTOs)
4. Migrar DTOs de workers-backend (3 DTOs)
5. Eliminar `class-validator` y `class-transformer`

### FASE 3 — Contratos gRPC documentados
**Estado:** Pendiente
**Qué hacer:**
1. Completar `contracts/grpc-contracts.md` con los RPCs de cada .proto
2. Documentar timeouts y fallbacks por par consumidor→proveedor
3. Auditar controllers gRPC — extraer lógica de negocio al Service

### FASE 4 — Domain/Repository: MOLDE VIVO
**Estado:** Pendiente (después de Fase 2)
**Qué hacer:**
1. Migrar `chatia-backend/conversations/` → Domain + Repository (MOLDE VIVO)
2. Migrar `pasarelapagos-backend/payments/` → Domain + Repository (CRÍTICO)
3. Migrar módulos restantes en orden de complejidad

### FASE 5 — Multi-tenant: auditoría de queries
**Estado:** Pendiente
**Qué hacer:**
1. Auditar todos los queries Prisma sin `ecosystemId`
2. Agregar `ecosystemId` donde falte
3. Tests de cross-tenant

### FASE 6 — Tests 85% + Enforcement CI
**Estado:** Pendiente
**Dependencia:** Fases 2-5 completadas
