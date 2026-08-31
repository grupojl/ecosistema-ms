# TenantContext — Multi-tenancy

## Estructura del contexto

```typescript
// packages/auth-server/src/types/tenant-context.ts
interface TenantContext {
  ecosystemId:    string;   // ID del ecosistema cliente (welver, manzana, mexus...)
  organizationId: string;   // ID de la org dentro del ecosistema
  userId:         string;   // Firebase UID del usuario autenticado
  role:           'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}
```

## Flujo de resolucion en chatia-backend

```
Request HTTP con Authorization: Bearer {token}
  → FirebaseAuthGuard verifica el JWT con Firebase Admin SDK
  → TenantGuard extrae claims del token decodificado:
      ecosystemId    ← del custom claim inyectado por welver
      organizationId ← del custom claim inyectado por welver
  → TenantGuard hace UPSERT PASIVO de Organization en chatia DB
      (si la org no existe, la crea — cada nuevo cliente se registra automaticamente)
  → TenantContext inyectado en el request
  → @Tenant() decorator lo expone en el controller
  → Controller lo pasa al service como parametro tipado
```

**El upsert pasivo es critico**: si falla, el request debe fallar con 503 — no
continuar con un organizationId que no tiene Organization en DB.

## Flujo de resolucion en pasarelapagos-backend

pasarelapagos tiene dos flujos de auth:

**Flujo SSO (welver):**
```
Token Firebase → AuthGuard → TenantGuard → OrgContext { organizationId, userId }
```

**Flujo API Key (B2B legacy):**
```
Header x-api-key → ApiKeyGuard → TenantContext { tenantId } → OrgContext derivado
```

Ambos flujos convergen en `OrgContext` antes de llegar al service.

## Claims Firebase esperados en el token

```json
{
  "ecosystemId":    "welver",
  "organizationId": "org_abc123",
  "role":           "ADMIN",
  "productPermissions": {
    "chatia": { "canRead": true, "canWrite": true },
    "pagos":  { "canRead": true, "canWrite": false }
  }
}
```

Estos claims los setea `realsass-sass-back` (welver) al crear/actualizar memberships.

## Filtrado obligatorio en Prisma

```typescript
// CORRECTO — siempre ambos filtros
async findAll(ctx: TenantContext) {
  return this.prisma.conversation.findMany({
    where: { ecosystemId: ctx.ecosystemId, organizationId: ctx.organizationId },
  });
}

// BLOQUEANTE — filtro incompleto
async findAll(organizationId: string) {
  return this.prisma.conversation.findMany({
    where: { organizationId },   // falta ecosystemId → data leak potencial
  });
}
```

## Rutas que pueden usar @Public()

- `GET /health` — health check de Railway
- `GET /metrics` — Prometheus scraping
- `POST /webhooks/{canal}` — pero verifican firma HMAC del canal
- `GET /widget` (chatia) — pero con ecosystemId en query param validado
