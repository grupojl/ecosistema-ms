# Capa 1 — Auth / TenantGuard / Multi-tenant
# Checklist 10/10

**Score actual: 8.5/10 — nivel Auth0 / Clerk**
**Score objetivo: 10/10 — nivel Stripe platform**

## Completado

- [x] `TenantGuard` en `@ecosistema-ms/auth-server` — centralizado
- [x] `ecosystemId` + `organizationId` resueltos del token Firebase en cada request
- [x] Upsert pasivo de `Organization` en TenantGuard — crea la org si no existe
  (chatia-backend: cada request que llega de un ecosistema nuevo crea la Organization)
- [x] `@Public()` decorator para rutas sin auth (health, webhooks con firma propia)
- [x] `@Tenant()` decorator — inyecta TenantContext en controller params
- [x] `FirebaseDecodedToken` tipado con custom claims del owner-dashboard
  (`organizationId`, `productPermissions`, `organizations`)
- [x] pasarelapagos tiene guards multiples: `AuthGuard`, `TenantGuard`, `WriteGuard`, `PciGuard`
- [x] `PciGuard` para rutas de creacion de pago — compliance

## Pendiente para 10/10

### Audit de TenantGuard (S1 — URGENTE, DT-006)
- [ ] Correr audit: `grep -rL "TenantGuard" */src/**/*.controller.ts`
  y verificar que cada resultado tiene `@Public()` en todos sus metodos
- [ ] chatia-backend: confirmar que `WidgetController` y `WebhooksController`
  tienen firma HMAC propia antes de procesar (no dependen del TenantGuard)
- [ ] notificaciones-backend: verificar `NotificationsController` tiene guard

### Decisiones de degradacion (documentar antes de escalar)
- [ ] Que hace el sistema si Firebase Admin SDK no esta disponible?
  Respuesta esperada: 503 en /health, 401 en rutas autenticadas
- [ ] Que pasa si el upsert pasivo de Organization falla en chatia?
  El request debe fallar con 503 — no con un error de FK constraint silencioso
- [ ] Timeout del TenantGuard: si Firebase tarda mas de 3s en verificar -> 503 o 401?

### Tests (S2)
- [ ] Test: token valido con ecosystemId → TenantContext resuelto correctamente
- [ ] Test: token sin claims de organizationId → 401
- [ ] Test: request a ruta protegida sin Authorization header → 401
- [ ] Test: ruta con @Public() → pasa sin token

### Enforcement CI (S3)
- [ ] ESLint rule: `@Controller` sin `@UseGuards` que incluya `TenantGuard` = bloqueante
  (con excepcion para controllers donde todos los metodos son `@Public()`)

## Regla dura

Un controller autenticado sin `TenantGuard` es un data leak potencial cross-tenant.
Se bloquea en code review — no se mergea con ticket de deuda.
