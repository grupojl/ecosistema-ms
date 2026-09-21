# TenantContext extendido con Market

## Cambio en @ecosistema-ms/auth-server

El `TenantContext` es el contrato central que fluye por todos los microservicios.
Agregar `marketCountry` como campo opcional mantiene backward compatibility total.

```typescript
// packages/auth-server/src/types/tenant-context.ts

export interface TenantContext {
  organizationId: string    // existente
  ecosystemId:    string    // existente
  userId:         string    // existente
  role:           Role      // existente
  marketCountry?: string    // NUEVO — ISO 3166-1 alpha-2, undefined si no aplica
}
```

## Dónde se extrae

En el `TenantGuard` o en un middleware previo al guard:

```typescript
// guards/tenant.guard.ts — agregar extracción de header
const marketCountry = request.headers['x-market-country'] as string | undefined

context.set<TenantContext>('tenant', {
  ...existingFields,
  marketCountry: marketCountry?.toUpperCase() ?? undefined,
})
```

## Headers estándar

```
X-Tenant-ID:       <organizationId>   // existente
X-Ecosystem-ID:    <ecosystemId>      // existente
X-Market-Country:  CO                 // NUEVO — opcional
X-Market-ID:       <marketId>         // NUEVO — opcional, UUID del Market resuelto
```

## Checklist

- [ ] MKT-PKG-01: Agregar `marketCountry?` a TenantContext interface
- [ ] MKT-PKG-02: Extraer `X-Market-Country` en TenantGuard
- [ ] MKT-PKG-03: Bump de versión del package (minor — cambio backward compatible)
- [ ] MKT-PKG-04: Actualizar tipos en todos los MS que importan TenantContext
