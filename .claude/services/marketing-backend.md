# marketing-backend — Ficha técnica

**Puerto HTTP:** 3005  
**Puerto gRPC:** 5006  
**Estado:** ✅ Implementado — pendiente deploy Railway  
**Score arquitectura:** 8.0 (ZodFilter desde el inicio, multi-tenant completo, processors con degradación elegante)  

---

## Responsabilidad

Optimización de gasto en ads y automatización de campañas.
Integra Meta Ads, Google Ads y TikTok Ads en una capa unificada
con atribución de conversiones y reglas de automatización.

## Norte de referencia

Ver `.claude/architecture/norte-marketing.md` para el análisis completo.

**Resumen ejecutivo:**
- **Triple Whale** → fuente unificada de verdad: ROAS calculado por nosotros (no por la plataforma), sync cada 15 min, alertas proactivas si ROAS < 1.0
- **Motion** → decisiones en < 30 segundos para no-técnicos: máximo 5 métricas visibles, automatización en lenguaje humano, log de acciones automáticas visible
- **Northbeam** → honestidad sobre atribución: last-click documentado como limitación, blended ROAS vs channel ROAS ambos visibles, `campaignId` nullable

**Regla de oro:** ¿Esta feature ayuda a gastar menos en ads que no funcionan
o más en los que sí funcionan? Si no → no pertenece a v1.



---

## Dominios

### ad-accounts
Conexión y gestión de cuentas publicitarias por plataforma.
Un `AdAccount` pertenece a una organización y una plataforma.
El `accessToken` se cifra via PII service antes de persistir.

### campaigns
Gestión de campañas con métricas diarias (`DailyMetric`) y
reglas de automatización (`AutomationRule`).

Formato de condition/action en AutomationRule:
```json
{
  "condition": { "metric": "roas", "operator": "lt", "value": 1.5, "windowDays": 3 },
  "action":    { "type": "pause" }
}
{
  "condition": { "metric": "ctr", "operator": "gt", "value": 0.05, "windowDays": 1 },
  "action":    { "type": "scale_budget", "factor": 1.2 }
}
```

### attribution
Pipeline de atribución: `pasarelapagos-backend` emite `attribute-conversion`
(fire-forget) → `AttributeConversionProcessor` lo consume → asigna la conversión
a campaña/ad_set → emite evento a `analytics-backend`.

---

## Queues BullMQ

| Queue | Job | Frecuencia / Trigger |
|-------|-----|----------------------|
| `campaign-sync` | `sync-platform-metrics` | Cron cada 15 min |
| `campaign-automation` | `check-automation-rules` | Cron cada 1 hora |
| `marketing-attribution` | `attribute-conversion` | Fire-forget desde pagos |

---

## Endpoints Internal (para superadmin)

```
GET  /internal/campaigns?ecosystemId&organizationId&platform&status&page&limit
GET  /internal/campaigns/:id
GET  /internal/ad-accounts?ecosystemId&organizationId
GET  /internal/attribution?ecosystemId&organizationId&from&to
GET  /internal/metrics/summary?ecosystemId&organizationId
```

Auth: `x-internal-api-key` (mismo valor que todos los MS)

---

## Endpoints REST (para frontend de cada ecosistema)

```
GET    /api/v1/ad-accounts                    # listar cuentas de la org
POST   /api/v1/ad-accounts                    # conectar cuenta nueva
DELETE /api/v1/ad-accounts/:id                # desconectar cuenta

GET    /api/v1/campaigns                      # listar campañas con métricas
GET    /api/v1/campaigns/:id/metrics          # métricas diarias de una campaña
GET    /api/v1/campaigns/:id/metrics/summary  # ROAS, CTR, CPC agregados

GET    /api/v1/automation-rules               # reglas por campaña
POST   /api/v1/automation-rules               # crear regla
PATCH  /api/v1/automation-rules/:id           # activar/desactivar
DELETE /api/v1/automation-rules/:id

GET    /api/v1/attribution                    # eventos de conversión atribuidos
```

---

## Invariantes de dominio

1. `ecosystemId` + `organizationId` presentes en TODOS los queries Prisma
2. Un `AttributionEvent` referencia un `paymentId` único — nunca se duplica (jobId determinista)
3. El `accessToken` de AdAccount NUNCA se retorna en responses REST — solo se usa internamente
4. Las reglas de automatización se evalúan SOLO sobre métricas con `windowDays` completos de datos
5. Un adapter con CB abierto NO lanza excepción que interrumpa otros adapters en el mismo job

---

## Circuit breakers

| Adapter | CB key | Fallback |
|---------|--------|---------|
| `MetaAdsAdapter` | `meta-ads` | log warn + notif fire-forget |
| `GoogleAdsAdapter` | `google-ads` | log warn + notif fire-forget |
| `TikTokAdsAdapter` | `tiktok-ads` | log warn + notif fire-forget |

---

## Schema Prisma (resumen)

```
AdAccount      → platform, externalId, organizationId, ecosystemId, accessToken(cifrado)
Campaign       → adAccountId, externalId, status, dailyBudget
DailyMetric    → campaignId, date, impressions, clicks, spend, conversions, revenue, roas
AutomationRule → campaignId, condition(Json), action(Json), isActive
AttributionEvent → paymentId(unique), campaignId?, ecosystemId, organizationId, revenue
```

---

## Estado de implementación

| Ítem | Estado |
|------|--------|
| Schema Prisma (6 modelos) | ✅ |
| Dockerfile + railway.json | ✅ |
| entrypoint.sh (migrate + start) | ✅ |
| AdAccount domain + MetaAdsAdapter | ✅ |
| SyncMetricsProcessor | ✅ |
| AutomationCheckProcessor | ✅ |
| AttributeConversionProcessor | ✅ |
| CampaignScheduler (cron jobs) | ✅ |
| InternalModule (5 endpoints superadmin) | ✅ |
| ZodValidationPipe + ZodExceptionFilter | ✅ (desde el inicio) |
| LoggerModule (pino) | ✅ |
| PrometheusModule | ✅ |
| Tests unitarios (automation-check) | ✅ |
| fire-forget desde pasarelapagos | ✅ (WebhookProcessor CAPTURED) |
| cifrar accessToken (PII service) | ⏳ Fase 2 |
| GoogleAdsAdapter | ⏳ Fase 2 |
| TikTokAdsAdapter | ⏳ Fase 2 |
| circuit breaker opossum (MetaAdsAdapter) | ⏳ Fase 2 |
| emitir a analytics-backend post-atribución | ⏳ Fase 2 |
| Deploy Railway | ⏳ Pendiente env |
---

## Dependencias de otros servicios

| Servicio | Relación | Contrato |
|----------|----------|---------|
| `pasarelapagos-backend` | Produce `marketing-attribution` jobs | Queue BullMQ → Redis compartido |
| `analytics-backend` | Recibe eventos de conversión atribuida | BullMQ `analytics-events` |
| `notificaciones-backend` | Alertas de CB abierto | BullMQ `notifications` (fire-forget) |
| `superadmin` | Consume `/internal/*` | HTTP + `x-internal-api-key` |
