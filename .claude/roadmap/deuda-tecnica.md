# Deuda técnica — ecosistema-ms

Última actualización: 2026-10-14 (sección chatia-backend al final)

---

## Cerrado en sesión 2026-09-29 ✅ — Audit B tipado + tsconfig

### Audit B: Contratos / Tipado — 0 hallazgos reales

**B1 · as any sin marca** — 3 → 0
- `pasarelapagos-backend/test/stripe-adapter.spec.ts` — mocks tipados con `Partial<Stripe.Event/Charge/RawError>`

**B1b · : any en producción** — 14 reales → 0
- Channel adapters (`whatsapp`, `instagram`, `messenger`, `tiktok`): `payload: any` → `payload: unknown` + interfaces locales WhatsApp
- `chatia-backend/src/core/notifications/notifications.service.ts`: `where: any` → `Prisma.NotificationWhereInput`
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
- `chatia-backend/src/infrastructure/types/opossum.d.ts` — tipos complementarios para opossum
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
Archivo duplicado sin usar. **Ya no existe** (eliminado en la reestructura ADR-022).

### [ECO-MS-03] pnpm prisma generate + pnpm typecheck completo — P1 ✅ RESUELTO 2026-10-08
> `pnpm typecheck` y `pnpm build` pasan en los 6 servicios (cada script ya corre `prisma generate`). Ver ADR-020 addendum.
> Los errores no eran solo de `prisma generate`: había archivos truncados, imports rotos por la reestructura y drift schema↔código (corregidos).
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

---

## Post-reestructura 2026-10-08 (ADR-020 / ADR-021)

### Pendiente
- [ ] **P0** Correr tests: `chatia` y `pasarelapagos` tienen `jest.config.ts` **y** clave `jest` en package.json (jest aborta). `marketing`: 1 spec falla. Specs de pasarela/chatia pueden estar desactualizados.
- [ ] **P0** Smoke test con DB + Redis reales. Los 6 servicios ya completan el bootstrap de Nest (rutas mapeadas, 0 duplicadas) con DB/Redis inexistentes; falta probar migraciones, conexiones y un request real.
- [ ] **P1** `InternalModule` de notificaciones y analytics nunca se importa (endpoints /internal/* inexistentes en runtime); chatia: `DlqModule` y `MultimodalModule` sin importar.
- [ ] **P1** workers exige `GROQ_API_KEY` al bootstrap (debería degradar con elegancia, ver norte de degradación).
- [ ] **P1** Construir las 6 imágenes Docker (cambios de entrypoint/prisma.config/logger sin probar) y validar en Railway.
- [x] pasarela: `PAYMENT_ORG_CONFIG_REPO` ahora tiene provider (`PrismaPaymentOrgConfigRepository`).
- [ ] **P1** Prisma `output` por servicio (hoy el cliente de `node_modules` lo pisa el último `generate`; mitigado con scripts en serie). Ver ADR-020 addendum.
- [ ] **P1** `nest start --watch` (`start:dev`): los alias `@/` no se resuelven sin `tsc-alias`; verificar flujo de dev.
- [ ] **P1** `pnpm prisma migrate deploy` en workers (enum `CANCELLED`) y revisar migraciones de los demás servicios (no se probó ninguna).
- [ ] **P1** marketing: adapters Google/TikTok son stubs; `AttributionService` no existe (solo el processor); decidir qué `TENANT_PRODUCT_KEY`/claims emite el sass-back.
- [ ] **P2** Duplicados post-reestructura: `chatia-backend/src/<modulo>/_deprecated/*.bak`, specs en carpetas viejas (`src/ai-config`, `src/contacts`…), `*.bak` varios. Limpiar o mover specs a `core/`.
- [ ] **P2** Controllers de agents/webhooks acceden a Prisma directo (agents.controller) — viola capa; pasar a service/repository.
- [ ] **P2** Endpoint `POST /assistant/chat` ahora autenticado: confirmar con el frontend/dashboard que envía Bearer + `x-organization-id`.

### Cerrado hoy
- [x] ECO-MS-03 typecheck/build completos en 0 errores.
- [x] DT-023 `getAgentMetrics` ya usaba `GROUP BY` en DB (había un método viejo duplicado y truncado; eliminado).
- [x] DT-031 health de pasarela: `SELECT 1` + `PING` Redis reales.
- [x] Domain/Repository **contacts** y **conversations** (chatia) completos.

---

# Deuda técnica — chatia-backend (sesiones 2026-10-14)

> **Alcance: SOLO `chatia-backend`.** Lo que afecta a otros servicios figura aparte, en "Detectado fuera de chatia".
> Plan completo: `roadmap/chatia-backend-10-de-10.md` · Proveedores: `infrastructure/providers-fallback.md`.
>
> **Estado al cierre (2026-10-15, tercera tanda):** `tsc` limpio · `lint:check` limpio · `pnpm build` OK ·
> **601 tests unitarios + 50 de integración** (Postgres + Redis reales) en verde · cobertura unitaria **92 %** (umbral en `jest.config.ts`: 90/78/80/90).
> **Nada está commiteado** (~330 archivos modificados: incluye el autoformato de prettier que ya hacía `pnpm lint`).
> **Nota de puntaje (rúbrica `audit-service`): 9,5 / 10** (medida 2026-10-15; ver `AUDIT-LAST.md`). Para el 10: imagen Docker construida (+0,25) y staging con smoke test (+0,25).

## ✅ Tercera tanda (2026-10-15): pilares 1-3 al techo pre-producción
- **Seguridad:** 20 MEDIA del escáner revisados (1 real corregido, 19 falsos positivos; escáner mejorado → 0 MEDIA). `attack-surface.integration.spec.ts` (30 ataques HTTP a webhooks y widget). Errores de webhook uniformes. ADR-023: RLS evaluado, no adoptado hasta DT-015.
- **Flujo:** LLM real probado (opt-in `TEST_LLM_LIVE=1`); carga concurrente 40 entregas → 1/1/1; Redis caído → 503 en 3 s (`addWithTimeout`, bug real). **Pendiente:** sandbox de Meta (requiere credenciales de prueba).
- **Tests:** branches 80,5 % → 85,7 %; services sin spec 2 → 0; Stryker instalado (`@stryker-mutator/core` + `jest-runner` en el catálogo, `stryker.config.json`, `pnpm test:mutation`): 66,97 % → **96,55 %** en 7 archivos críticos (una corrida completa final: 419 muertos, 1 timeout, 15 sobrevivientes). Sobrevivientes: textos de log (auto-reply), 5 constantes estáticas + 2 equivalentes (webhook-signature), prefijo y regex del hex (token-cipher) y 1 de rate-limit.
- **Para repetir mutación:** `cd chatia-backend && pnpm test:mutation` (~15 min; no correr otra carga a la vez).
- **Código muerto detectado, sin borrar** (2026-10-16 se intentó borrar `schemas.ts` y el entorno bloqueó el `rm`; borrarlo a mano): `src/infrastructure/transport/internal/schemas.ts` (nadie lo importa) y `LangGraphEngine` (16 branches sin cubrir; depende de la decisión AiConfig vs AssistantConfig).

## ✅ Respuesta automática a canales — CONECTADA (2026-10-15)

Mensaje entrante (WhatsApp/Instagram/Messenger/TikTok) → `recordInboundMessage` idempotente → cola `auto-reply` (`jobId: reply_<messageId>`, 3 intentos) → `AutoReplyProcessor` → `AutoReplyService` → cola de salida → canal.
- [x] `AutoReplyProcessor` creado y registrado en `QueueModule` (solo con `REDIS_ENABLED`); cola `auto-reply` registrada en `QueueModule` y `ConversationsModule`; `AutoReplyService` provisto y exportado.
- [x] `handleIncomingMessage` encola la respuesta (no si el webhook es duplicado ni con `AUTOREPLY_ENABLED=false`).
- [x] Helper único `queue/outgoing-job.ts` para armar el job de salida: el envío manual ahora incluye `externalId` y `webhookVerifyToken` (antes iba a `.../undefined/messages`).
- [x] Tests: unitarios de `AutoReplyService` / `ConversationsService` / processors, y de integración con Postgres real (`auto-reply.integration.spec.ts`: duplicados, contexto, idempotencia por `replyTo`, handoff, aislamiento entre organizaciones).
- [x] Bugs hallados y corregidos de paso: Instagram solo procesaba el primer mensaje de un webhook en lote (Messenger sí procesaba todos); Messenger/Instagram enviaban el token en la query string (ahora header `Authorization: Bearer`).
- [x] **Prueba punta a punta con Redis real** (2026-10-15): `queues-redis.integration.spec.ts` — entrante → asistente → envío → SENT, reenvío sin duplicar, FAILED tras agotar reintentos, aislamiento por organización. Corre con `TEST_DATABASE_URL` + `TEST_REDIS_URL` (prefijo propio `it-<run>`, se obliteran las colas al terminar). **Nunca** apuntar `TEST_REDIS_URL` a un Redis de producción.
- [x] **Bug hallado por esa prueba:** los `jobId` `reply:<id>` y `send:<id>` eran rechazados por BullMQ (`Custom Id cannot contain :`), así que la respuesta automática y el envío saliente nunca se encolaban. Ahora `reply_`, `send_`, `msg_`.
- [x] `OutgoingMessageProcessor`: los `updateMany` filtran por organización (vía conversación → canal), con test de aislamiento.
- [ ] **Verificar con una cuenta real** que `AssistantChatService` resuelve proyecto/config por canal (`ChannelAccount.projectId` → `Project.slug`, o proyecto por defecto de la organización).
- [ ] **Decisión de producto**: hay DOS configuraciones de IA — `AiConfig` (por canal; la usa el viejo `LangGraphEngine`, con prompts de **inmobiliaria**) y `AssistantConfig` (por proyecto; la usa `AssistantChatService`). La respuesta automática usa `AssistantConfig` y de `AiConfig` solo lee `isEnabled` y `humanTakeoverKeywords`. Definir si `AiConfig` se depreca (y `LangGraphEngine` + `langgraph/nodes` se borran: ~40 líneas sin cubrir) o qué campos conserva.

## Hecho hoy (chatia)

Seguridad
- [x] Webhooks de Meta: firma obligatoria con App Secret sobre cuerpo crudo (`rawBody: true`); antes pasaban los falsos y se rechazaban los reales. Verificado con requests firmadas reales contra la app levantada.
- [x] WebSocket autenticado (antes cualquiera leía mensajes de cualquier tenant) + salas validadas por organización.
- [x] **Aislamiento entre ecosistemas**: `ensureOrganization` hacía `upsert` solo por id → un ecosistema con un token que reclamara el `organizationId` de otro operaba como esa organización. Igual con el `uid` de agente. Corregido y probado contra Postgres real.
- [x] Widget: sesión firmada, límites por IP/sesión, cuota diaria, `allowedOrigins` por proyecto, CORS propio, snippet escapado, ruta corregida (`/api/v1/widget`, daba 404).
- [x] Entorno estricto en producción (`NODE_ENV` obligatorio, claves mínimas), sin bypass de desarrollo por defecto, Swagger apagado, `helmet`, throttler, claves en tiempo constante.
- [x] `channel-accounts` no devuelve `accessToken` ni `appSecret`; **cifrado en reposo AES-256-GCM** de ambos (`TokenCipher`, rotación con `_PREVIOUS`) + comando `pnpm encrypt:tokens` (idempotente, `DRY_RUN=1`). Probado con la CLI real.
- [x] SSRF: descarga de URLs de la FAQ con IP fijada, bloqueo de rangos privados/metadata de nube, redirecciones validadas, tope de tamaño/tiempo.

Funcionalidad y datos
- [x] **Rutas que daban 404** porque sus módulos nunca se importaban: contacts, agents, projects, ai-config, messages, dlq. Montadas. Un test compara todos los `*.controller.ts` con los montados (verificado que falla si se quita un módulo).
- [x] **Migraciones**: `Conversation.market_country` y `organization_configs` existían en el schema pero ninguna migración las creaba (una base nueva rompía al leer una conversación). Migración idempotente `20261014000100_sync_schema_drift`. Verificado `prisma migrate diff` sin deriva.
- [x] RAG: indexación real dentro de chatia (antes los documentos quedaban en PENDING para siempre), chunking, embeddings en lote, pgvector (`20261014000000_kbchunk_pgvector`, segura si no hay extensión), degradación a búsqueda por texto, `reindexar` ya no se ignora (jobId único).
- [x] Servidor gRPC implementado (no tenía ningún método) + `UpsertChunks` / `UpdateDocumentStatus`; contrato probado con el `.proto` real.
- [x] Proveedores con fallback (LLM, STT, TTS, imagen) y embeddings reales; mensaje de reintento sin escalar a humano; métricas Prometheus.
- [x] Privacidad: retención (`SESSION_RETENTION_DAYS`=90, `MESSAGE_RETENTION_DAYS`=0 apagado) con cron diario, y derecho de supresión `DELETE /api/v1/contacts/:id/data` (OWNER/ADMIN). Probado contra Postgres real.
- [x] Health `/health/live` y `/health/ready` (503 real), cierre ordenado, pool de Postgres con timeouts.
- [x] Dependencias fantasma declaradas (`opossum`, `@nestjs/schedule`, `@nestjs/cache-manager`, `@nestjs/websockets`, `nestjs-pino`, ...) y lockfile actualizado; `CacheService` pasó de `redis` a `ioredis` con `SCAN`.
- [x] Jest reparado (una sola config), 12 specs de plantilla vacíos reemplazados; ESLint de 3 119 problemas a 0 (autoformato + tipado de requests/guards); tipos propios de `opossum`.
- [x] CI: Postgres con pgvector + Redis como servicios, `migrate deploy` desde cero, chequeo de deriva `schema ↔ migraciones`, tests de integración, `lint:check` sin `--fix`, umbral de cobertura.

## Pendiente (chatia)

P0
- [ ] **Smoke test con Redis real**: en esta máquina no hay Redis ni Docker. Sin Redis nunca se probaron colas BullMQ de punta a punta (entrada/salida/auto-reply/ingesta), el store de límites compartido, ni `/health/ready` con Redis vivo. Hacerlo con `docker compose up` o en staging.
- [ ] **Cargar variables en Railway** (si falta alguna, el arranque falla a propósito): `NODE_ENV=production`, `META_APP_SECRET`, `WIDGET_SESSION_SECRET` (≥32), `CHANNEL_TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`), `PLATFORM_ADMIN_KEY`, `INTERNAL_API_KEY`, `ALLOWED_ORIGINS`, `REDIS_ENABLED=true`, Firebase (3 vars), `SILICONFLOW_API_KEY`, `ELEVENLABS_API_KEY` + `ELEVENLABS_DEFAULT_VOICE_ID`.
- [ ] **Rotar la `GROQ_API_KEY`** (apareció en una salida de esta sesión; hoy también está en `.env`, que es local pero conviene rotarla).
- [ ] **Verificar el estado de `_prisma_migrations` en la base de Railway**: las dos migraciones nuevas son idempotentes, pero si esa base se creó con `db push` y no tiene historial, `migrate deploy` falla con P3005 y hay que hacer *baseline*. **No lo probé: el `.env` apunta a Railway y no corrí nada contra esa base.**
- [x] ~~**Borrar basura**~~ HECHO 2026-10-15 (`*.bak*`, `x`, `x.sh`, `chat-ia-back.xml`, `Dockerfile.bak`, carpetas legacy `src/ai-config|contacts|messages`, `app.controller.spec.ts`; quitada la exclusión de jest). Todo sigue en el historial de git. Lista original: `*.bak*`, `x`, `x.sh`, `chat-ia-back.xml`, `Dockerfile.bak`, `.env.example.bak`, carpetas legacy `src/ai-config`, `src/contacts`, `src/messages`, `src/app.controller.spec.ts`. Sus specs están excluidos en `jest.config.ts` (`testPathIgnorePatterns`); quitar esa línea al borrarlos.
- [ ] **Tras activar el cifrado en producción**: correr `pnpm encrypt:tokens` (primero con `DRY_RUN=1`) para cifrar los tokens que ya están en claro.

P1
- [ ] **Respuesta por voz (TTS) no está conectada al envío**: `respondWithAudio` se calcula y nadie lo usa; la cola de salida solo soporta texto y `MultimodalService.toAudio` no se llama desde ningún lado. Falta subir el audio a cada canal (WhatsApp: `POST /{phone-id}/media` y mensaje tipo audio), leer la voz por organización (`multimodal.service.ts:89`) y elegir cuándo responder en audio. Las cadenas Cartesia → ElevenLabs ya existen y están probadas.
- [ ] **Cobertura**: 59 % → **77 %** (2026-10-15; umbral en `jest.config.ts` 75/64/59/75) → objetivo 85 %. Ya cubiertos: canales, processors, conversations/assignment/assistant/projects/contacts/messages/notifications/kb-document/org-config/ai-config, retención, DLQ, filtros/guards/pipes. Sin cubrir: `prisma-conversations.repository`, `conversations.service`, canales (`whatsapp`/`instagram`/`messenger`/`tiktok`: parseo y envío), `outgoing/incoming processors`, `assistant-config/session`, `assignment`, `projects`, `langgraph`, `groq.service`, `firebase.service`, `kb-document`, `dlq`, interceptores y filtros. Subir el umbral de `jest.config.ts` con cada tanda.
- [ ] **Verificar con claves reales**: ids de modelo de SiliconFlow (`gpt-oss-120b`, `Qwen3-VL-32B`, `bge-m3`), JSON mode, latencia vs timeout 15 s, español; Llama 4 Scout con imágenes (DNI, facturas); ElevenLabs `opus_48000_64` (¿Ogg/Opus para WhatsApp?); que el Postgres de Railway tenga **pgvector** (si no, la FAQ sigue funcionando sin índice). La llamada real a Groq sí se probó (respuesta OK).
- [ ] **Voz a texto de SiliconFlow** queda apagada hasta definir `SILICONFLOW_STT_MODEL` tras probar español.
- [ ] **TikTok**: confirmar formato de firma y `TIKTOK_APP_SECRET` contra su documentación.
- [ ] **Aislamiento**: las consultas filtran por `organizationId`, que es único global, y la brecha entre ecosistemas ya está cerrada y probada; la regla dura pide además `ecosystemId` en el `where`. Decidir: dejarlo por invariante + tests, o centralizar en una extensión de Prisma / RLS de Postgres.
- [x] Lock distribuido del cron de retención (`CacheService.tryLock`, SET NX EX; sin Redis corre igual). HECHO 2026-10-15.
- [x] **`BullModule.forRoot` y `HealthModule` registran colas aunque `REDIS_ENABLED=false`** (2026-10-16): conexión única en `infrastructure/queue/bull-connection.ts`; con Redis deshabilitado es `lazyConnect` + `retryStrategy: () => null` (sin reintentos ni spam de `ECONNREFUSED`; un `add()` falla rápido). Los módulos siguen registrando sus colas. Verificar el log arrancando sin Redis.
- [x] CI chatia: Trivy fijado a `0.28.0` y la imagen se carga localmente en PRs (`load: true`) para poder escanearla. Los otros 5 workflows siguen con `@master`. Pendiente: `Dockerfile` usa `shamefully-hoist`, lo que ocultó las dependencias fantasma.

P2
- [ ] Mensaje de "servicio caído" configurable por organización (hoy fijo, a propósito, para que no parezca un handoff).
- [ ] PDF: la indexación devuelve un error explicativo; falta extracción real (requiere agregar una dependencia al catálogo).
- [ ] Cola de salida con recuperación de webhooks perdidos (reconciliación contra la API de Meta) y monitoreo de calidad/límites del número de Meta con alerta técnica.
- [ ] Destino de las alertas técnicas (hoy: log `[ALERTA TÉCNICA]` + métrica `provider_chain_exhausted_total`). Definir Slack/PagerDuty/email.
- [ ] `manzana` / `mexus`: plantillas con `TODO`; completar o quitar.
- [x] `SETUP.md` actualizado 2026-10-16 (cadenas de proveedores, cifrado de tokens, firma obligatoria) y se quitó un `curl` con un JWT pegado. `README.md` sin revisar.
- [ ] F4: pruebas de carga (k6), backups de Postgres con prueba de restauración, RTO/RPO, runbooks, branch protection en `main`.

## Estructura core / infrastructure / modules (ADR-022) — 2026-10-15
- [x] chatia-backend: `src/` con solo `core/`, `infrastructure/`, `modules/`; 14 controllers en `modules/common/`; `architecture.spec.ts` lo fuerza. Rutas sin cambios.
- [ ] **Replicar en analytics, pasarelapagos, notificaciones, workers y marketing** con `.claude/tools/restructure-src.js` (adaptar los mapas por servicio). Uno por vez, con typecheck + tests en verde.
- [x] Repositories Prisma de contacts, conversations, organization-config y agents → `infrastructure/prisma/repositories/` (binding en `prisma.module.ts`). `agents` con domain + service + repository.
- [x] Bug de historial: `AssistantSessionService.appendMessage` ahora es un UPDATE atómico (antes dos mensajes seguidos se pisaban). Probado con 25 escrituras en paralelo contra Postgres real.
- [x] Seguridad `agents`: `register` exigía nada (público) y confiaba en `organizationId`/`firebaseUid` del body; ahora TenantGuard + identidad del token. `PATCH` ya no deja a un miembro cambiar `role`/`isActive` ni editar a otros.
- [x] **Prisma fuera de `core/` y `modules/` (saldado 2026-10-15)**: 19 services + el widget + la strategy de Welver pasaron a repositories (`infrastructure/prisma/repositories/`, binding en `prisma.module.ts`). `architecture.spec.ts` lo exige en estricto (0 archivos). Los records vienen del cliente generado (`import type` de `@/generated/prisma/client.js`): es una fuga de tipos aceptada, no de comportamiento.
- [ ] **Trinquete que queda (`INFRA_DEBT`)**: 13 archivos de `core/` importan `infrastructure/queue|channels|events` (colas y WebSocket detrás de un puerto). Solo puede achicarse.

## Hallazgos de la segunda tanda (2026-10-15)
- [x] **Welver nunca recibió sus datos de negocio**: la consulta "¿hay agentes en línea?" filtraba `Conversation.organizationId`, columna que no existe; Prisma lanzaba y el `catch` devolvía valores por defecto. Corregido (se deriva de `channelAccount.organizationId`) y probado contra Postgres real.
- [x] **Etapas de conversación**: el tipo de dominio declaraba `INTERESTED`/`CLOSED_WON`/`CLOSED_LOST`, que no existen en el enum de la base (`INFORMED`, `CLOSING`, `FOLLOW_UP`, `HUMAN`). Alineado y `updateStage` rechaza etapas inválidas con error claro.
- [x] `PATCH /ecosystems/:id/config` ahora valida con Zod (claves conocidas, `projectType` abierto, máx. 16 KB).
- [x] Cobertura 78 % → 92 %: specs para analytics-events, rag, ingesta FAQ, strategies, circuit-breaker, firebase, groq, multimodal, adaptadores de documento/ubicación, organizaciones, widget-config, controller de ecosistemas (clave de plataforma) y la descarga SSRF-safe (redirecciones, 2 MB, timeout).
- [x] **P0 funcional — medios de WhatsApp** (2026-10-16): `WhatsAppChannel.resolveMedia` hace `GET /{media-id}` con el token de la cuenta → URL https temporal + `Authorization`. `ChannelMediaService` (infrastructure/channels) lo invoca desde `IncomingMessageProcessor` (token descifrado en el worker, nunca viaja por Redis) y `MultimodalService.normalize` recibe `media` con URL + cabeceras; los adaptadores de audio, imagen y documento descargan con esas cabeceras. Si el lookup falla, degrada al texto de respaldo sin reintentar todo el mensaje. De paso `normalize` ahora recibe el `organizationId` real (antes `''`). Tests: `channel-media.spec.ts` + `processors.spec.ts`. **Pendiente:** probarlo con una cuenta real de WhatsApp (Graph API real).
- [ ] `GroqService` sigue vivo solo porque lo usa `LangGraphEngine` (legacy, sin invocar): cae junto con la decisión `AiConfig` vs `AssistantConfig`.
- [ ] Sin spec propio: `prisma.service` (arranque) y `multimodal.service` (cubierto en `multimodal.spec.ts`, el script de métricas lo marca por el nombre).

## Detectado fuera de chatia (no se tocó)
- [x] **`jobId` con `:` en otros servicios** (2026-10-16): cambiados a `_` en pasarelapagos (`reconcile_`, `attribution_`, `webhook_` con `externalId` saneado), workers (`campaign_`) y marketing (`sync_`, `automation_`); `tsc` limpio en los tres. **Pendiente:** probar con Redis real (`TEST_REDIS_URL`). Ojo: jobs ya encolados con el id viejo no se deduplican contra el nuevo.
- [ ] **workers-backend** — `FaqIngestProcessor` es un stub (`TODO Sprint W-2`) y `VectorIndexProcessor` usa `nomic-embed-text` por Groq (el endpoint de embeddings de Groq no está verificado). Chatia indexa por su cuenta, pero si se reactiva el flujo de workers debe usar el MISMO modelo que chatia (`EMBEDDINGS_MODEL`).
- [ ] **workers-backend** — su controller gRPC responde con campos `snake_case`, pero el cargador de proto trabaja en camelCase: los campos se pierden. Revisar también el de otros servicios.
- [ ] **packages/grpc-client** — `grpcMetadata()` ya envía `x-internal-api-key` (desde `INTERNAL_API_KEY`, 2026-10-16, `dist/` reconstruido). **Falta** que los callers lo usen: ninguno llama a `grpcMetadata()` (workers: analytics-export, campaign-email, vector-index; notificaciones: dlq-monitor). Hasta adoptarlo ahí no se puede activar `GRPC_AUTH_ENFORCED=true` en chatia.
- [ ] **packages/logger** — se agregó redacción de secretos y se recorta el query string de las URLs; afecta a los 6 servicios y hay que reconstruir `dist/`.
- [ ] **pnpm-lock.yaml** — cambió (37 líneas, solo entradas de chatia). Revisar antes de commitear.
- [ ] **packages/proto/proto/chatia.proto** — se agregaron `UpsertChunks` y `UpdateDocumentStatus` (cambio compatible).

## Cómo retomar mañana
1. `cd chatia-backend && pnpm typecheck && pnpm lint:check && pnpm test` — debe estar todo en verde (lo está al cierre).
2. Pendientes P0 de arriba (Redis real, variables en Railway, rotar `GROQ_API_KEY`, `_prisma_migrations` de Railway) y la decisión de producto `AiConfig` vs `AssistantConfig`.
3. Postgres temporal para pruebas de integración: ya no está corriendo de forma garantizada. Para recrearlo: `initdb` en una carpeta temporal, puerto 54329, y `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/<db> pnpm test:integration`. **No usar la base del `.env` (apunta a Railway).**
