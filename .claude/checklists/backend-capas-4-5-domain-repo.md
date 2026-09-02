# Backend Capas 4+5 — Domain/Application + Repository
# Checklist 10/10

**Score actual: 1/10 — No iniciado**
**Score objetivo: 10/10**

## ❌ Estado actual

Todos los services en todos los microservicios usan `PrismaService` directamente.
No existe capa Domain ni Repository en ningún módulo.

## ✅ Completado

- [x] ADR-002 documentado — decisión de aplicar Domain/Repository a módulos con lógica compleja
- [x] Patrón de referencia definido en `architecture/01-backend-capas.md`

## ⏳ Pendiente para 10/10

### MOLDE VIVO — crear primero (desbloquea todo lo demás)
- [ ] Migrar `chatia-backend/src/conversations/` a Domain + Repository + toEntity()
  → Será el molde de referencia para todos los demás módulos

### chatia-backend — módulos a migrar (por prioridad)
- [ ] `conversations/` — domain + repository (MOLDE VIVO)
  - `domain/conversation.entity.ts` — estados, tags, soft-delete como invariantes
  - `domain/conversation.errors.ts` — ConversationNotFoundError, etc.
  - `repository/conversations.repository.interface.ts`
  - `repository/prisma-conversations.repository.ts` con `toEntity()` privado
- [ ] `contacts/` — domain + repository
- [ ] `projects/` — domain + repository
- [ ] `agents/` — domain + repository (configuración de agentes como entidad)
- [ ] `faq/knowledge-base/` — domain + repository

### pasarelapagos-backend — módulos a migrar
- [ ] `modules/payments/` — domain + repository (CRÍTICO — transacciones financieras)
  - `domain/payment.entity.ts` — estados, transiciones, invariantes
  - `domain/payment.errors.ts` — PaymentFailedError, InsufficientFundsError, etc.
- [ ] `modules/webhooks/` — domain + repository
- [ ] `modules/tenants/` — domain + repository

### notificaciones-backend
- [ ] `notifications/` — domain + repository (estados de envío, idempotencia)

### analytics-backend
- [ ] `analytics/` — projections como value objects (no entidades con identidad)

### workers-backend
- [ ] `campaigns/` — domain + repository

### Tests de domain (cuando existan las capas)
- [ ] Un test de domain nunca importa `@nestjs/*` ni `@prisma/client`
- [ ] Unit tests de `domain/*.entity.ts` — funciones puras, sin mocks
- [ ] Unit tests de services mockeando solo el repository (no Prisma)

### Enforcement CI
- [ ] `dependency-cruiser` rule `no-prisma-in-service`
  → Falla si `*.service.ts` importa `PrismaService` directamente (post-migración)

## Patrón de referencia — toEntity() obligatorio

```ts
// ❌ Cast que silencia errores de tipo
return prismaResult as unknown as Conversation;

// ✅ Mapper explícito verificado por TypeScript
private toEntity(row: PrismaConversation): Conversation {
  return {
    id:             row.id,
    ecosystemId:    row.ecosystemId,
    organizationId: row.organizationId,
    status:         row.status as ConversationStatus,
    tags:           row.tags,
    // ...cada campo — TypeScript falla aquí si Prisma cambia el schema
  };
}
```

## Regla dura

Un `as any` o `as unknown as` nuevo en un repository es un bug de arquitectura.
Se bloquea en code review sin excepción.
Los `// @ecosistema-ms/jsonb-cast` son la única excepción documentada.
