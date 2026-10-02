# JSONB casts en audit.service.ts — ADR-007

## Cast temporal documentado

```typescript
// pasarelapagos-backend/src/modules/audit/audit.service.ts
const data = { ... } as Prisma.AuditLogCreateInput;
```

**Por que existe:** el campo `organizationId` fue agregado en sprint8.
Si el cliente Prisma no fue regenerado tras la migracion, el campo no esta
en el tipo `AuditLogCreateInput`. El cast permite compilar antes de aplicar
la migracion.

**Cuando eliminarlo:** cuando se confirme que `prisma migrate deploy` de sprint8
esta aplicado en todos los entornos y el cliente fue regenerado.

**Accion:** eliminar el cast y usar el tipo inferido directamente.

## Campos JSONB reales (excepcion permanente)

Los campos de tipo `Json` en Prisma devuelven `JsonValue` — un tipo union muy
amplio. Los casts sobre estos campos son necesarios y deben marcarse:

```typescript
// @ecosistema-ms/jsonb-cast
const payload = row.payload as NotificationPayload;
const metadata = row.metadata as Record<string, unknown>;
const config = row.config as EcosystemConfig;
```
