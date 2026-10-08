# ADR-021 — Reparación post-reestructura: typecheck/build en 0 errores

**Fecha:** 2026-10-08
**Estado:** Aceptado — implementado. Sin verificar contra DB/Redis ni con tests (ver "Pendiente").
**Repo:** grupojl/ecosistema-ms

## Contexto

Tras la reestructura `core/ + modules/ + infrastructure/` (commit `fa3d297`), `pnpm typecheck`
fallaba en los 6 servicios (>700 errores): imports rotos, controllers perdidos, módulos truncados,
código escrito contra un schema distinto al real y dependencias mayores nuevas (Zod 4, Stripe 22,
firebase-admin 14). Además `node dist/main.js` no podía arrancar (alias `@/` sin resolver).

## Decisión

El **schema Prisma es la fuente de verdad**: el código y los dominios se alinearon a él, no al revés.
Resultado: `pnpm typecheck && pnpm build` → exit 0 en los 6 servicios, con `dist/main.js` y alias resueltos.

## Cambios de comportamiento (revisar antes de deploy)

| Servicio | Cambio |
|---|---|
| chatia | `POST /assistant/chat` exige `TenantGuard` (antes público y con `organizationId: ''`, inutilizable). El widget sigue público y resuelve `ecosystemId` desde el proyecto. |
| chatia | `ConversationStatus` = `OPEN · HUMAN_TAKEOVER · RESOLVED · EXPIRED` (se eliminaron `ASSIGNED`/`CLOSED`, que no existen en DB). Cambia el filtro `status` del API. |
| chatia | `ConversationsService` ya no usa Prisma: todo va por `IConversationsRepository` (ADR-002). `addTag` ahora normaliza (lowercase). |
| chatia | Contacts: repositorio reescrito; multi-tenant por `organizationId` + `organization.ecosystemId` (Contact no tiene `ecosystemId`). `GET /contacts` responde `{ success, data, meta }`. |
| chatia | `/internal/conversations/*` filtraba por columnas inexistentes (fallaba en runtime sin que `tsc` lo detectara); ahora resuelve ecosistema vía `ChannelAccount → Organization`. |
| chatia | Restaurado el controller de webhooks entrantes (`GET/POST /webhooks/:channelType/:externalId`), que un scaffold había reemplazado. |
| chatia | `GET /notifications` y `PATCH …/read` operan por `tenant.agentId` (antes pasaban `organizationId`). |
| chatia | `POST /faq/query` valida que la KB pertenezca a la org antes de responder (RAG). |
| pasarela | `/internal/payments` mapea `tenantId→ecosystemId`, `amountMinor→amount`, `providerId→provider`, `failureMessage→failureReason`; estado terminal exitoso = `CAPTURED`. |
| pasarela | `PaymentStatus` de dominio incluye `PARTIALLY_REFUNDED`. Stripe `apiVersion` → `2026-08-26.dahlia` (la que tipa stripe@22). |
| pasarela | `auth.e2e-spec.ts` reescrito al modelo SSO vigente (claims + `x-organization-id`); el modelo `User` ya no existe. |
| workers | Enum `CampaignStatus` += `CANCELLED` (migración `20261008000000_campaign_status_cancelled`). Requiere `prisma migrate deploy`. |
| workers | Nuevo `RedisModule` (token `REDIS_CLIENT`) para el lock del scheduler; `POST /campaigns/:id/dispatch` implementado. |
| marketing | `TenantGuard` sin estado en `@ecosistema-ms/auth-server` (claims Zod: `ecosystemId`, `organizationId`, `role`, `permissions[producto]`). Producto = env `TENANT_PRODUCT_KEY` (default `marketing`). |
| marketing | Adapters Google/TikTok son **stubs** con degradación elegante (no existían en ningún lado). |
| todos | `prisma.config.ts`: `url: process.env["DATABASE_URL"] ?? ""` — `prisma generate` ya no exige la variable. `migrate` sí la necesita. |

## Convenciones que quedan

- Un servicio con `IRepository` inyectado no usa `this.prisma` (regla dura vigente); casos multi-tabla = método del repositorio.
- Payloads externos entran como `unknown` y se tipan con `type` locales (no `any`).
- Nunca `as Prisma.InputJsonValue` sobre DTOs/estados: solo sobre columnas `Json`.

## Pendiente (no resuelto por este ADR)

Ver `roadmap/deuda-tecnica.md` → sección "Post-reestructura 2026-10-08".
