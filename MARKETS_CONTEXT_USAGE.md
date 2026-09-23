# Markets en ecosistema-ms — guía de uso (ADR-014)

## Cómo llega el contexto de Market

El header `X-Market-Country` viaja desde el caller (ecommerce-back o el front).
El TenantGuard de chatia-backend lo extrae y lo pone en `request.tenant.marketCountry`.

## Cómo usarlo en un controller

```typescript
import type { TenantContext } from '../common/types/tenant-context'
import { Tenant } from '../common/decorators/tenant.decorator'

@Get('algo')
async getAlgo(@Tenant() tenant: TenantContext) {
  const country = tenant.marketCountry  // 'CO' | 'MX' | undefined
  // undefined → comportamiento actual sin cambios (backward compatible)
}
```

## Estado de adopción

| MS | Modelo | Campo | Estado |
|----|--------|-------|--------|
| chatia-backend | Conversation | marketCountry | ✅ Prisma listo — adopción en service pendiente |
| pasarelapagos-backend | Payment | marketCountry | ✅ Prisma listo — adopción en controller pendiente |
| analytics-backend | AnalyticsEvent | marketCountry | ✅ Prisma listo — adopción en gRPC pendiente |
| notificaciones-backend | — | header X-Market-Country | ⏳ pendiente |
| workers-backend | — | job payload | ⏳ pendiente |

## Regla invariante (ADR-014)

Estos MS **nunca resuelven** el Market — solo leen el header que les llega.
Si no llega → `marketCountry` es `undefined` → comportamiento actual sin cambios.
