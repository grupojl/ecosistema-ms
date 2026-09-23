# ADR-014 — Markets: estado ecosistema-ms

**Fecha:** 2026-09-21
**Estado:** ✅ IMPLEMENTADO (contexto propagado via TenantContext)

## Principio

Los MS de ecosistema-ms son CONSUMIDORES del contexto de Market.
El modelo Market vive en welver/realsass-sass-back — nunca aquí.

## Qué se implementó

### packages/auth-server
- [x] MKT-PKG-01: TenantContext.marketCountry? (ISO 3166-1 alpha-2, opcional)
- [x] MKT-PKG-02: TenantGuard extrae X-Market-Country → request.tenant.marketCountry
- [x] MKT-PKG-03: ⚠ Bump de versión pendiente (no bloqueante)
- [x] MKT-PKG-04: TenantContext local de chatia-backend actualizado

### chatia-backend
- [x] MKT-CH-01: marketCountry? en TenantContext local
- [x] MKT-CH-02: X-Market-Country extraído en TenantGuard
- [x] MKT-CH-03: market_country en Conversation (Prisma schema)
- [ ] MKT-CH-04: inyectar en system prompt del agente (siguiente sprint)
- [ ] MKT-CH-05: dimensión market_country en analytics events

### pasarelapagos-backend
- [x] MKT-PP-01: market_country en Payment (Prisma schema)
- [ ] MKT-PP-02..04: uso en PaymentController + listados (siguiente sprint)

### analytics-backend
- [x] MKT-AN-01: market_country en AnalyticsEvent + índice
- [ ] MKT-AN-02..04: uso en gRPC TrackEvent + proyecciones (siguiente sprint)

## Backward compatible

Si `X-Market-Country` no llega → `marketCountry` es `undefined`.
Los MS existentes funcionan igual que antes. Cero breaking changes.

## Migraciones Prisma pendientes (requieren DB)
```bash
cd chatia-backend        && pnpm prisma migrate dev --name add_market_country
cd pasarelapagos-backend && pnpm prisma migrate dev --name add_market_country
cd analytics-backend     && pnpm prisma migrate dev --name add_market_country
```
