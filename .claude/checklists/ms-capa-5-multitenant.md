# Capa 5 — Multi-tenant como invariante transversal
# Checklist 10/10

**Score actual: 8.0/10 — nivel Shopify multi-tenant**
**Score objetivo: 10/10**

## Completado

- [x] Doble filtro `ecosystemId` + `organizationId` en modelos de dominio
  (chatia: Conversation, Message, Contact, Agent, Project...)
  (analytics: AnalyticsEvent, DailyConversationSummary...)
  (notificaciones: Notification, ContactPreference...)
  (workers: JobLog, Campaign...)
- [x] `TenantGuard` resuelve ambos IDs del token Firebase en cada request
- [x] Upsert pasivo de `Organization` en chatia — se crea si no existe
- [x] `Ecosystem` como modelo propio en chatia — aislamiento por FIREBASE_PROJECT_ID
- [x] pasarelapagos: doble campo `tenantId` (legacy B2B) + `organizationId` (SSO)
  — compatibilidad con flujos API Key y flujos SSO
- [x] Indices en DB: `@@index([ecosystemId])`, `@@index([organizationId, status])`

## Pendiente para 10/10

### Audit de queries sin ecosystemId (S1 — urgente)
- [ ] `grep -rn "findMany\|findFirst\|findUnique" chatia-backend/src --include="*.ts"`
  Verificar que TODAS las queries criticas tienen `ecosystemId` en el where
  Excepcion aceptada: queries por ID unico donde el ID ya garantiza aislamiento
- [ ] Mismo audit en notificaciones-backend, analytics-backend, workers-backend

### Tests de seguridad cross-tenant (S2)
- [ ] Test: request con ecosystemId de otro ecosistema → 0 resultados
  (no error, no datos del otro ecosistema)
- [ ] Test: conversation.findOne con organizationId ajeno → NotFoundException
- [ ] Test: job de workers con organizationId ajeno no aparece en listado

### Enforcement CI (S3)
- [ ] ESLint rule `@ecosistema-ms/no-unscoped-prisma-query`
  Detecta `findMany/findFirst` sin `ecosystemId` en el `where`
  Excepcion: tablas globales (`Ecosystem`, `WebhookInbound`, `TenantApiKey`)

## Nota sobre pasarelapagos

pasarelapagos tiene una dualidad documentada:
- `tenantId` → ID del Tenant de la API Key (flujo B2B legacy)
- `organizationId` → UUID del owner-dashboard (flujo SSO nuevo)

Ambos campos son obligatorios en Payment y Customer desde sprint8.
El indice `@@index([organizationId, status, createdAt])` es el filtro principal SSO.

## Regla dura

Un query sin `ecosystemId` en el `where` que accede a datos de negocio
es un bug critico de seguridad — no un code smell.
Se bloquea en code review sin excepcion. No se mergea con ticket de deuda.
