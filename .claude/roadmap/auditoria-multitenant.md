# Auditoría multi-tenant — queries sin ecosystemId

**Última actualización:** 2026-09-02
**Estado: FASE 5 COMPLETA ✅**

## Contexto

En ecosistema-ms el scope de tenant es DOBLE:
- `ecosystemId` — identifica al cliente de la plataforma
- `organizationId` — identifica la organización dentro del ecosistema

Todo query Prisma de negocio debe llevar AMBOS filtros.

---

## Estado final por servicio

### chatia-backend ✅

| Archivo | Método | ecosystemId | organizationId | Estado |
|---------|--------|-------------|----------------|--------|
| `conversations.service.ts` | todos | ⚠️ Via Contact→Org | ✅ | DT-015 pendiente (no urgente) |
| `contacts.service.ts` | todos | — (Contact no tiene ecosystemId propio) | ✅ | ✅ Aceptable |
| `projects.service.ts` | todos | — (Project no tiene ecosystemId propio) | ✅ | ✅ Aceptable |
| `messages.service.ts` | todos | — (scope via channelAccount) | ✅ | ✅ Aceptable |
| `assignment.service.ts` | todos | — (agentes son por org) | ✅ | ✅ Aceptable |
| `assistant-config.service.ts` | todos | — (config es por org) | ✅ | ✅ Aceptable |
| `assistant-session.service.ts` | todos | — (sesión es por org) | ✅ | ✅ Aceptable |

### pasarelapagos-backend ✅

| Archivo | Método | ecosystemId (tenantId) | organizationId | Estado |
|---------|--------|------------------------|----------------|--------|
| `payments.service.ts` | `create()` | ✅ tenantId en DB | ✅ | ✅ |
| `payments.service.ts` | `findAll()` | ✅ via ctx.tenantId | ✅ | ✅ |
| `payments.service.ts` | `findOne()` | ✅ via paymentsRepo | ✅ | ✅ |
| `reconciliation.service.ts` | `schedulePendingReconciliation()` | ✅ tenantId en where | — | ✅ DT-006 |

### notificaciones-backend ✅

| Archivo | Método | ecosystemId | organizationId | Estado |
|---------|--------|-------------|----------------|--------|
| `notifications.service.ts` | `enqueue()` | ✅ en DTO | ✅ | ✅ |
| `notifications.service.ts` | `getStats()` | ✅ en where | ✅ | ✅ DT-011 |
| `preferences.service.ts` | `getPreferences()` | ✅ en where | ✅ | ✅ DT-014 |
| `preferences.service.ts` | `upsertPreference()` | ✅ en create | ✅ | ✅ |

### analytics-backend ✅

| Archivo | Método | ecosystemId | organizationId | Estado |
|---------|--------|-------------|----------------|--------|
| `analytics.service.ts` | `getOverview()` | ✅ | ✅ | ✅ |
| `analytics.service.ts` | `getAgentMetrics()` | ✅ | ✅ | ✅ |
| `analytics.service.ts` | `getConversationsByDay()` | ✅ | ✅ | ✅ DT-012 |
| `projections.service.ts` | `recalculateForOrg()` | ✅ | ✅ | ✅ |

---

## Único pendiente no urgente — DT-015

El modelo `Conversation` no tiene `ecosystemId` directo en Prisma.
Llega via join `Contact → Organization → ecosystemId`.
Funciona con un ecosistema. Requiere migración antes de escalar a múltiples.

## Comando de auditoría rápida

```bash
grep -rn "findMany\|findFirst\|findUnique" */src --include="*.ts" \
  | grep -v "ecosystemId\|tenantId\|organizationId" \
  | grep -v "node_modules\|.spec.ts\|repository.interface\|health\|prisma.service"
```

## Test de cross-tenant (FASE 6)

```ts
it('no retorna datos de otro ecosistema', async () => {
  // Crear datos con ecosystemId = 'welver'
  // Request con ecosystemId = 'manzana'
  // Resultado debe ser vacío o 403
});
```
