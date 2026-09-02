# Contrato: TenantContext

## Shape (definido en @ecosistema-ms/auth-server)

```ts
export interface TenantContext {
  readonly ecosystemId:    string;   // ID del ecosistema cliente (welver, manzana, mexus...)
  readonly organizationId: string;   // ID de la org dentro del ecosistema
  readonly userId:         string;   // firebaseUid del usuario autenticado
  readonly role:           TenantRole;
}

export type TenantRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
```

## Cómo se resuelve

El `TenantGuard` de `@ecosistema-ms/auth-server`:
1. Verifica el token Firebase con Firebase Admin SDK
2. Extrae `ecosystemId` de los custom claims del token (emitidos por welver/sass-back)
3. Extrae `organizationId` del header `x-organization-id` o de los claims
4. Inyecta el `TenantContext` en el request para los decorators `@Tenant()`

## Custom claims del token (emitidos por welver/realsass-sass-back)

```ts
interface PlatformClaims {
  ecosystemId:    string;
  organizationId: string;
  role:           string;
}
```

Ver `decisions/ADR-003-custom-claims.md` en el repo `grupojl/welver` para
el detalle de cómo se emiten los claims.

## Regla dura

El shape de `TenantContext` es idéntico en todos los microservicios.
Si un servicio nuevo necesita un campo extra, se extiende `@ecosistema-ms/auth-server`,
no se crea un TenantContext local.
