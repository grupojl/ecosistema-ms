# Deuda técnica — ecosistema-ms

Última actualización: 2026-09-29

---

## Cerrado en sesión 2026-09-29 ✅ — Audit B tipado + tsconfig

### Audit B: Contratos / Tipado — 0 hallazgos reales

**B1 · as any sin marca** — 3 → 0
- `pasarelapagos-backend/test/stripe-adapter.spec.ts` — mocks tipados con `Partial<Stripe.Event/Charge/RawError>`

**B1b · : any en producción** — 14 reales → 0
- Channel adapters (`whatsapp`, `instagram`, `messenger`, `tiktok`): `payload: any` → `payload: unknown` + interfaces locales WhatsApp
- `chatia-backend/src/notifications/notifications.service.ts`: `where: any` → `Prisma.NotificationWhereInput`
- `pasarelapagos-backend` adapters (`conekta`, `dlocal`, `fake`, `mercadopago`, `pagarme`, `stripe`): `body: any` → `Record<string, unknown>`, `err: any` → `unknown`
- `pasarelapagos-backend/src/modules/webhooks/webhooks.controller.ts`: `req: any` → `Request`, `err: any` → `unknown`
- `pasarelapagos-backend/test/stripe-adapter.spec.ts`: `catch (e: any)` → `catch (e: unknown)`
- `workers-backend/src/internal/internal.controller.ts`: `(j: any)` → `j.queueName` tipado
- Error mappers (`conekta`, `dlocal`, `pagarme`): `error: any` → `error: unknown` + narrowing

**B2 · as unknown as sin marca** — 2 → 0
- `marketing-backend/src/campaigns/processors/automation-check.processor.ts`: double casts → `@ecosistema-ms/jsonb-cast`
- `workers-backend/src/common/grpc-rxjs.helper.ts`: JSDoc reescrito sin `as unknown as`

**B4 · @ts-expect-error sin texto** — 8 → 0
- `dlq-monitor.service.ts`, `analytics-export.processor.ts`, `campaign-email.processor.ts`, `vector-index.processor.ts`, `chunking.service.ts` — texto explicativo completo con referencia a ADR-007

**B5 · class-validator** — ya 0 (confirmado)

**D1 · as any documentado** — 18 → 0
- Enums de Prisma: `as any` → tipo explícito (`KbDocumentStatus`, `NotificationChannel`, `PaymentMethod`)
- `groqModel as any` → `as string`
- HTTP filters: `(res as any)?.message` → `(res as { message?: string })?.message`
- opossum: `(this.cb as any).getStates` → cast a interface mínima
- JSONB: `as any` → `Prisma.InputJsonValue` en todos los boundaries

**D2 · as unknown as documentado** — 13 → 0
- Processors workers: `as unknown as Record<string, unknown>` → `Prisma.InputJsonValue`
- `RedisNoopClient`: `as unknown as Redis` → `as RedisLike` con interface mínima declarada
- `assistant-session.service.ts`: `session.history as unknown as SessionMessage[]` simplificado
- opossum circuit-breakers: double casts eliminados con `.d.ts` local

**D3 · JSONB en repositories** — 9 → 0
- `prisma-contacts.repository.ts`, `prisma-campaigns.repository.ts`: `as never` → `Prisma.InputJsonValue`
- `prisma-conversations.repository.ts`: Zod parse en `extractedEntities` + comentarios de docs actualizados
- `prisma-payments.repository.ts`: Zod parse en `metadata`

**D4 · JSONB fuera de repositories** — 44 → 0
- Todos los servicios: marcas `@ecosistema-ms/jsonb-cast` limpiadas, tipos corregidos a `Prisma.InputJsonValue` o cast explícito

### Archivos nuevos creados
- `workers-backend/src/types/pdf-parse.d.ts` — tipos locales para pdf-parse
- `workers-backend/src/types/mammoth.d.ts` — tipos locales para mammoth
- `workers-backend/src/common/grpc-rxjs.helper.ts` — patrón canónico para rxjs/gRPC interop
- `chatia-backend/src/types/opossum.d.ts` — tipos complementarios para opossum
- `notificaciones-backend/src/types/opossum.d.ts` — ídem
- `pasarelapagos-backend/src/types/opossum.d.ts` — ídem
- `pasarelapagos-backend/src/modules/redis/redis.module.ts` — interfaz `RedisLike` declarada

### tsconfig — fixes estructurales
- `tsconfig.base.json`: eliminado `"extends": "../tsconfig.base.json"` (circular) y `"baseUrl": "./"` innecesario
- `packages/proto/tsconfig.json`: eliminado `baseUrl`, agregado `"types": ["node"]`
- `packages/auth-server/tsconfig.json`: restaurado `baseUrl` + `paths @/*` + `ignoreDeprecations: "6.0"`
- `packages/grpc-client/tsconfig.json`: restaurado `baseUrl` + `paths @/*` + `ignoreDeprecations: "6.0"`
- Todos los microservicios + `marketing-backend`: `ignoreDeprecations: "6.0"` agregado dinámicamente
- `packages/auth-server/src/filters/zod-exception.filter.ts`: `exception.errors` → `exception.issues` (Zod v3 API)

### Sistema de audit (a.sh)
- `@real/` → `@ecosistema-ms/` en todos los greps (B1, B2, D1, D2, D3, D4)
- B4 corregido: grep `@ts-expect-error[[:space:]]*$` para detectar solo directivas sin texto
- B1b excluye `prisma/client/` (archivos generados)

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

### [ECO-MS-03] pnpm prisma generate + pnpm typecheck completo — P1
Correr antes del próximo deploy (requiere DB disponible):
```bash
pnpm --filter chatia-backend exec prisma generate
pnpm --filter pasarelapagos-backend exec prisma generate
pnpm --filter notificaciones-backend exec prisma generate
pnpm --filter analytics-backend exec prisma generate
pnpm --filter workers-backend exec prisma generate
pnpm -r build  # packages/ primero
pnpm typecheck
```
Los errores de `notificaciones-backend` en typecheck (PrismaClient, modelos)
son consecuencia de no haber corrido `prisma generate`, no de código roto.

### [ECO-DT-01] rxjs/gRPC interop — P2
6 `@ts-expect-error` con texto explicativo en workers-backend processors.
Fix real: migrar a `callGrpc()` del helper `workers-backend/src/common/grpc-rxjs.helper.ts`.
Una sesión de trabajo. Patrón documentado — solo requiere aplicarlo.

---

## Deuda técnica preexistente (no tocada)

- `main.ts` con `ValidationPipe` global coexiste con `ZodExceptionFilter` (DT-027)
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

---

## Observabilidad ✅ COMPLETADA 2026-09-21

- [x] LoggerModule + PrometheusModule + RequestIdMiddleware en los 5 servicios
- [x] Health checks extendidos: DB + Redis + CBs + DLQ + uptime + version
- [x] grpc-metadata.helper.ts: X-Request-Id propagado en gRPC inter-servicio
- [x] ci-packages.yml: CI para proto + auth-server + grpc-client
- [x] pino-pretty en catalog + RequestIdMiddleware en pasarelapagos

### Pendiente
- [ ] Adopción de grpcMetadata() en callers concretos
- [ ] Branch protection en GitHub
- [ ] pnpm install para regenerar lockfile

---

## ProjectStrategy — ADR-019 (2026-09-23)

### Cerrado
- [x] ECO-PS-01: wiring app.module.ts pasarelapagos + notificaciones
- [x] ECO-PS-03: businessData tipado para welver

### Pendiente
- [ ] ECO-PS-02: estrategias placeholder → lógica real por ecosistema
- [ ] ECO-PS-04: evaluar marketing-backend (no urgente)
