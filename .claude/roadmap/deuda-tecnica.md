# Deuda técnica — ecosistema-ms

Última actualización: 2026-09-19

---

## Cerrado en sesión 2026-09-19 ✅

- [x] /health extendido (ExtendedHealth) en los 5 MS
- [x] InternalModule en chatia, pasarela y workers
- [x] InternalApiKeyGuard

---

## Pendiente activo

### [ECO-MS-01] INTERNAL_API_KEY en Railway — P0 para producción
Configurar la misma clave en todos los servicios.
Sin esto, superadmin recibe 403 en todos los /internal/*.

### [ECO-MS-02] conversations.service.updated.ts en chatia — P1
Archivo duplicado sin usar. Eliminar:
`chatia-backend/src/conversations/conversations.service.updated.ts`

### [ECO-MS-03] make typecheck en cada MS — P1
Correr antes del próximo deploy:
```bash
pnpm --filter chatia-backend typecheck
pnpm --filter pasarelapagos-backend typecheck
pnpm --filter workers-backend typecheck
pnpm --filter notificaciones-backend typecheck
pnpm --filter analytics-backend typecheck
```

---

## Deuda técnica preexistente (no tocada en esta sesión)

- main.ts con ValidationPipe global coexiste con ZodExceptionFilter (DT-027)
  — documentado, no rompe, se resuelve en S4
- DT-ECO-01 (domain/repo en ecommerce-back) — cerrado en sesión 2026-09-17

---

## Sprint Markets — ADR-014 ✅ COMPLETADO 2026-09-21

### Cerrado
- [x] MKT-PKG-01: TenantContext.marketCountry? en packages/auth-server
- [x] MKT-PKG-02: TenantGuard extrae X-Market-Country
- [x] MKT-CH-01/02/03: TenantContext local + TenantGuard chatia + Prisma Conversation
- [x] MKT-PP-01: Prisma Payment.market_country
- [x] MKT-AN-01: Prisma AnalyticsEvent.market_country + índice

### Pendiente siguiente sprint
- [ ] MKT-CH-04: system prompt contextualizado por país en agente chatia
- [ ] MKT-PP-02/03: marketCountry en PaymentController + listados
- [ ] MKT-AN-02/03: marketCountry en gRPC TrackEvent + proyecciones por Market
- [ ] Migraciones Prisma (requieren DB): chatia + pasarela + analytics
