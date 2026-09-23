# tasks.md — ecosistema-ms estado actual

**Última actualización:** 2026-09-19 — multimodal chatia-backend completado — marketing-backend completado

---

## COMPLETADO ✅ — Sesión 2026-09-19

### /health extendido
- [x] chatia-backend — ExtendedHealth con CB (groq, whatsapp) + DLQ (incoming, outgoing)
- [x] pasarelapagos-backend — ExtendedHealth con CB (providers) + DLQ (reconcile, webhook)
- [x] notificaciones-backend — ExtendedHealth con CB (wa/email/push) + DLQ
- [x] analytics-backend — ExtendedHealth (sin CB, sin DLQ)
- [x] workers-backend — ExtendedHealth (sin CB externos) + DLQ (faq, vector, campaign)

### chatia-backend — adapters multimodales
- [x] `src/channels/adapters/multimodal.interface.ts` — contrato IMultimodalAdapter
- [x] `src/channels/adapters/speech-to-text.adapter.ts` — Groq Whisper + CB
- [x] `src/channels/adapters/document-to-text.adapter.ts` — extracción PDF sin librerías
- [x] `src/channels/adapters/image-to-text.adapter.ts` — Claude Vision + CB
- [x] `src/channels/adapters/location-to-text.adapter.ts` — OSM Nominatim gratuito
- [x] `src/channels/adapters/text-to-speech.adapter.ts` — Cartesia + CB
- [x] `src/channels/adapters/video-to-text.adapter.ts` — stub Fase 2 con fallback amigable
- [x] `src/channels/multimodal.service.ts` — orquestador, switch por msg.type
- [x] `src/channels/multimodal.module.ts` — registra todos los adapters
- [x] `IncomingMessageProcessor` — normalize() antes de handleIncomingMessage
- [x] `app.module.ts` — MultimodalModule importado
- [x] 16/16 checks de verificación pasados
- [x] Cero class-validator, CB en proveedores externos, fallback en todos

### InternalModule
- [x] chatia-backend/src/internal/ — conversaciones escaladas
- [x] pasarelapagos-backend/src/internal/ — payments CRUD
- [x] workers-backend/src/internal/ — jobs DLQ
- [x] Registrado en los 3 app.module.ts

---

## PENDIENTE

- [ ] `INTERNAL_API_KEY` en Railway — mismo valor en todos los servicios
- [ ] `make typecheck` en cada MS → 0 errores
- [ ] `make g` — push a GitHub → Railway redeploy automático

---

## Guía de verificación rápida

```bash
# Verificar /health extendido en todos los MS
grep -rn "dlqDepth\|circuitBreakers\|ExtendedHealth" \
  chatia-backend/src/health/ \
  pasarelapagos-backend/src/modules/health/ \
  notificaciones-backend/src/health/ \
  analytics-backend/src/health/ \
  workers-backend/src/health/

# Verificar InternalModule registrado
grep -n "InternalModule" \
  chatia-backend/src/app.module.ts \
  pasarelapagos-backend/src/app.module.ts \
  workers-backend/src/app.module.ts
```

---

## PENDIENTE — Post sesión 2026-09-19

### ecosistema-ms
- [ ] `make typecheck-pagos` → 0 errores (tipos nuevos del fire-forget)
- [ ] `.env` de marketing-backend — DATABASE_URL, REDIS_URL, INTERNAL_API_KEY
- [ ] `pnpm install` — instalar dependencias de marketing-backend
- [ ] `make migrate-marketing` — crear tablas en marketing_db (primera vez)
- [ ] `make dev-marketing` → verificar HTTP :3005 + GET /health
- [ ] Deploy Railway — crear servicio marketing-backend

### superadmin (repo grupojl-control — separado)
- [ ] `MarketingClient` en `src/integration/marketing/marketing.client.ts`
- [ ] Registrar en `IntegrationModule`
- [ ] `MARKETING_BACKEND_URL` en Railway
- [ ] Alerta ROAS crítico en Command Center

### Pendientes técnicos de marketing-backend (Fase 2)
- [ ] `TODO(pii)` — cifrar `accessToken` antes de persistir (PII service)
- [ ] `TODO(phase2)` — GoogleAdsAdapter + TikTokAdsAdapter
- [ ] `TODO(cb)` — circuit breaker opossum en MetaAdsAdapter
- [ ] `TODO(fase2)` — emitir a analytics-backend después de AttributionEvent

---

## PENDIENTE — Post sesión multimodal

### chatia-backend
- [ ] `make typecheck-chatia` → 0 errores TypeScript
- [ ] `ANTHROPIC_API_KEY` en Railway — Claude Vision
- [ ] `CARTESIA_API_KEY` en Railway — Cartesia TTS
- [ ] Pasar `organizationId` real en `normalize()` — hoy se pasa `''`
      (`TODO(fase2)` en IncomingMessageProcessor línea 38)
- [ ] Config de voz por org — `voiceId` de Cartesia por `organizationId`
- [ ] `VideoToTextAdapter` — implementar con Gemini Flash (Fase 2)

### Pendientes técnicos de todos los MS
- [ ] `make typecheck-pagos` → 0 errores (fire-forget marketing agrega tipos)
- [ ] Correr x.sh sobre notificaciones-backend, analytics-backend, workers-backend
      (los 3 sin ZodExceptionFilter aún)
- [ ] Deploy marketing-backend en Railway

---

## Sprint Markets — ADR-014 (ecosistema-ms)

### packages/auth-server (bloqueante para todos los MS)

- [x] MKT-PKG-01: `marketCountry?` en TenantContext
- [x] MKT-PKG-02: Extraer X-Market-Country en TenantGuard
- [x] MKT-PKG-03: Bump minor del package
- [x] MKT-PKG-04: Actualizar imports en cada MS

### chatia-backend

- [ ] MKT-CH-01..05 (ver modules/chatia-backend/markets.md)

### pasarelapagos-backend

- [ ] MKT-PP-01..04 (ver modules/pasarelapagos-backend/markets.md)

### analytics-backend

- [ ] MKT-AN-01..04 (ver modules/analytics-backend/markets.md)

### notificaciones-backend / workers-backend

- [ ] Agregar marketCountry al payload de notificaciones
- [ ] Agregar marketCountry al contexto de jobs BullMQ

---

## ProjectStrategy multi-servicio — ADR-019 (2026-09-23)

- [ ] **[PS-01]** Importar `ProjectStrategyModule` + los 3 `{Eco}Module` en
      `pasarelapagos-backend/src/app.module.ts`
      → Done cuando: log de arranque muestra
      `Registry inicializado con estrategias: [WELVER, MANZANA, MEXUS, GENERIC]`

- [ ] **[PS-02]** Importar `ProjectStrategyModule` + los 3 `{Eco}Module` en
      `notificaciones-backend/src/app.module.ts`
      → Done cuando: mismo log de arranque en este servicio

- [ ] **[PS-03]** Completar `welver.strategy.ts` en pasarelapagos-backend con
      routing real de provider preferido de welver
      → Done cuando: `enrichPaymentContext` retorna `businessData` no vacío
      para al menos un caso real

- [ ] **[PS-04]** Completar `welver.strategy.ts` en notificaciones-backend con
      templates/canal preferido real de welver
      → Done cuando: `enrichNotificationContext` retorna overrides no vacíos

- [ ] **[PS-05]** Repetir PS-03/PS-04 para manzana y mexus cuando tengan
      requerimientos de negocio concretos — no antes (evitar lógica placeholder
      que nadie usa)

- [ ] **[PS-06]** Tipar `businessData` por ecosistema en
      `modules/{eco}/types/context.ts` de ambos servicios, reemplazando
      `Record<string, unknown>` — solo cuando PS-03/04 tengan contenido real
