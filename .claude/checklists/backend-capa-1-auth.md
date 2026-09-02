# Backend Capa 1 — Auth/Tenant resolution
# Checklist 10/10

**Score actual: 6/10**
**Score objetivo: 10/10**

## ✅ Completado

- [x] `@ecosistema-ms/auth-server` existe con guards y decorators base
- [x] `FirebaseAuthGuard` disponible como guard global
- [x] `TenantGuard` resuelve `ecosystemId` + `organizationId` del token Firebase
- [x] `@Public()` decorator para rutas sin auth
- [x] `@Tenant()` decorator para extraer el contexto de tenant

## ⏳ Pendiente para 10/10

### Unificación de guards (BLOQUEANTE)
- [ ] Verificar que los 5 servicios aplican `FirebaseAuthGuard` como `APP_GUARD` global
  — no como guard ad-hoc en cada controller
- [ ] `pasarelapagos-backend` tiene su propio `firebase-auth.service.ts` — verificar si
  duplica la lógica de `@ecosistema-ms/auth-server` → si sí, migrar y eliminar
- [ ] Documentar en `contracts/tenant-context.md` el shape exacto del TenantContext
  que usan los 5 servicios (puede diferir hoy)

### CORS y seguridad
- [ ] Verificar que `ALLOWED_ORIGINS` está configurado explícitamente en los 5 servicios
- [ ] Sin wildcard `*` en ningún servicio que maneja datos de tenant

### Tests (pendiente)
- [ ] Unit test `FirebaseAuthGuard` — token válido, expirado, revocado
- [ ] Unit test `TenantGuard` — ecosystemId presente, ausente, organizationId inválido
- [ ] Integration test: request sin token → 401; con token válido → 200

### Enforcement CI
- [ ] `dependency-cruiser` rule `no-local-firebase-verify`
  → Falla si un servicio reimplementa verificación Firebase fuera de `@ecosistema-ms/auth-server`

## Referencia de archivos

- `packages/auth-server/src/decorators/`
- `packages/auth-server/src/guards/` (si existe) o `packages/auth-server/src/`
- `pasarelapagos-backend/src/modules/firebase/firebase-auth.service.ts` — revisar si duplica
- `pasarelapagos-backend/src/common/shared-guards.module.ts`
