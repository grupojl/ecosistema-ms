# ecosistema-ms — Contexto para Claude

**Fecha de última auditoría:** 2026-09-12
**Puntaje real (código auditado):** 7.6 / 10
**Puntaje proyectado (sesiones anteriores):** 8.3 — 9.1 ← DESINCRONIZADO

> El puntaje 8.3-9.1 de sesiones anteriores asumía que el x.sh corrió
> sobre los 5 servicios. En realidad corrió sobre 2 (chatia + pagos).
> El puntaje real auditado directamente en el código es 7.6.
> Ver .claude/AUDIT-LAST.md para el desglose completo.

---

## Stack

- NestJS 11 · Prisma 7 · PostgreSQL · Redis · BullMQ · Firebase Admin
- gRPC inter-servicio (@nestjs/microservices + @grpc/grpc-js)
- pnpm 10 workspaces con catalog único
- Deploy: Railway — 6 servicios separados, mismo repo (marketing-backend listo para Railway)

## Microservicios

| Servicio | HTTP | gRPC | Estado |
|----------|------|------|--------|
| chatia-backend | 3000 | 5001 | ZodFilter + pino ✅ |
| pasarelapagos-backend | 3001 | 5002 | ZodFilter + pino ✅ |
| notificaciones-backend | 3002 | 5003 | Sin ZodFilter ⚠️ |
| analytics-backend | 3003 | 5004 | Sin ZodFilter + DT-023 pendiente ⚠️ |
| workers-backend | 3004 | 5005 | Sin ZodFilter ⚠️ |
| marketing-backend | 3005 | 5006 | ZodFilter + pino ✅ implementado |

## Lo más sólido

- Multi-tenancy: ecosystemId + organizationId en todas las queries críticas
- Documentación .claude: ADR-001..009, checklists, reglas duras, lifecycle
- BullMQ: jobs idempotentes, DLQ en todos los servicios críticos
- Circuit breakers: opossum (chatia/pagos/notificaciones), Redis CB (workers)
- Lock distribuido: SET NX EX en analytics projections y workers campaigns

## Las brechas reales hoy

1. Domain/Repository: solo conversations y payments tienen el patrón completo
2. getAgentMetrics: take: 50_000 × 2 en Node — bomba de escala en analytics
3. 3 de 5 servicios sin ZodExceptionFilter (ZodError → HTTP 500)
4. app.module.ts de los 5 servicios sin LoggerModule ni PrometheusModule importados
5. Health controller de pasarela: sin SELECT 1 a la DB

## Próximas tareas (en orden de impacto)

1. `make typecheck-chatia` → 0 errores post-multimodal
2. Agregar `ANTHROPIC_API_KEY` y `CARTESIA_API_KEY` en Railway (chatia-backend)
3. `make typecheck-pagos` → 0 errores post-fire-forget marketing
4. Deploy marketing-backend en Railway
5. Correr x.sh sobre notificaciones, analytics, workers (ZodFilter pendiente)

## Sesión actual — multimodal chatia-backend

### Adapters multimodales implementados en chatia-backend

| Adapter | Proveedor | Estado |
|---|---|---|
| SpeechToTextAdapter | Groq Whisper | ✅ |
| DocumentToTextAdapter | extracción PDF interna | ✅ |
| ImageToTextAdapter | Claude Vision | ✅ |
| LocationToTextAdapter | OSM Nominatim (gratuito) | ✅ |
| TextToSpeechAdapter | Cartesia | ✅ |
| VideoToTextAdapter | stub Fase 2 | ⏳ |

### Punto de inserción

`IncomingMessageProcessor` llama `MultimodalService.normalize()` antes de
`ConversationsService.handleIncomingMessage()`. El LLM siempre recibe texto.

### Variables de entorno nuevas en chatia-backend
```bash
ANTHROPIC_API_KEY=   # Claude Vision (ImageToTextAdapter)
CARTESIA_API_KEY=    # TTS (TextToSpeechAdapter)
# GROQ_API_KEY ya existe (SpeechToTextAdapter)
```
## Sesión actual — 2026-09-19

- marketing-backend implementado completo (36 archivos)
- pasarelapagos-backend: fire-forget en WebhookProcessor cuando CAPTURED
- monorepo: pnpm-workspace, package.json raíz, Makefile actualizados
## Regla antes de nueva sesión

Leer en orden: CLAUDE.md → AUDIT-LAST.md → decisions/ADR-009 → roadmap/deuda-tecnica.md

---

## Markets — contexto global en microservicios (ADR-014)

### Principio en este repo

Los MS de ecosistema-ms son **consumidores del contexto de Market**, no dueños del modelo.
El modelo Market vive en welver/realsass-sass-back.

### Cómo llega el contexto

```
X-Market-Country: CO    →  header HTTP desde el caller
X-Market-ID: <uuid>     →  header HTTP desde el caller (resuelto upstream)
```

Nunca se resuelve ni valida aquí. Si llega → se usa. Si no → comportamiento actual.

### Impacto por MS

| MS | Campo nuevo | Uso |
|----|------------|-----|
| chatia-backend | `marketCountry` en Conversation | System prompt contextualizado |
| pasarelapagos-backend | `marketCountry` en Transaction | Auditoría y reconciliación |
| analytics-backend | `marketCountry` en AnalyticsEvent | Dimensión de segmentación |
| notificaciones-backend | `marketCountry` en contexto | Templates localizados |
| workers-backend | `marketCountry` en job payload | Contexto de fulfillment |

### Cambio en packages/auth-server (TenantContext)

`marketCountry?: string` — campo opcional, backward compatible.
Ver `.claude/modules/packages/markets-tenant-context.md`

<!-- ADR-018 -->
---

## Dependencias — política única (ADR-018)

### El norte

**Google** (una versión, dueño, strict deps) · **Microsoft Rush** (cero phantom deps) ·
**OpenSSF / SLSA** (cadena de suministro)

*Toda dependencia es código ajeno que corre con nuestros permisos: entra con dueño,
con una sola versión y declarada donde se usa.*

### Reglas no negociables

```
Versión    solo catalog: o workspace:*  — nada hardcodeado
Declarar   todo import externo está en el package.json del workspace que lo usa
Libs       packages/* → frameworks en peerDependencies, nunca en dependencies
Nueva dep  checklist R4 del norte en el PR + dueño asignado
Lockfile   --frozen-lockfile en CI y en Railway
```

Ver `architecture/11-dependencias-norte.md` y `decisions/ADR-018-politica-dependencias.md`.

---

## ProjectStrategy — personalización por ecosistema (ADR-019)

Patrón replicado desde chatia-backend hacia pasarelapagos-backend y
notificaciones-backend: el core del microservicio nunca conoce el
ecosistema concreto, solo el contrato `ProjectStrategy`. Ver
`architecture/12-project-strategy-pattern.md` para el detalle y el
criterio de "cuándo aplica" antes de replicarlo en un microservicio nuevo.

Estado: scaffold generado, wiring de `app.module.ts` pendiente (manual,
ver `lifecycle/tasks.md` sección PS-01/PS-02).

Referentes de industria: Salesforce (Custom Fields tipados — de ahí sale
la regla de no dejar `businessData` como `Record<string, unknown>` para
siempre) y Shopify (extensibilidad desacoplada del deploy — evolución
futura, no urgente hoy).
