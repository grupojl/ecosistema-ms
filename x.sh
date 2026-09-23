#!/usr/bin/env bash
# =============================================================================
# x-markets-ecosistema-ms.sh
# Escribe la documentación de Markets en el monorepo ecosistema-ms/
# Ejecutar desde la raíz de ecosistema-ms/
# Git Bash (Windows): bash x-markets-ecosistema-ms.sh
# =============================================================================
set -e

echo "▶ [ecosistema-ms] Escribiendo documentación de Markets..."

# -----------------------------------------------------------------------------
# 1. ADR-014 — Markets en ecosistema-ms
# -----------------------------------------------------------------------------
mkdir -p .claude/decisions

cat > .claude/decisions/ADR-014-markets-context.md << 'EOF'
# ADR-014 — Markets: contexto global en microservicios

**Fecha:** 2026-09-19
**Estado:** Aceptado
**Referencia:** welver/ADR-014-markets-global.md (fuente de verdad del modelo)

---

## Contexto

Los microservicios de ecosistema-ms operan en contexto multi-tenant.
Cada tenant es una Organization de welver que tiene un `ecosystemId`.
Con la introducción de Markets, cada request puede tener además un `marketId`
que indica el contexto geográfico de la operación.

---

## Decisión

### Markets NO se modelan en ecosistema-ms

El modelo `Market` vive en `welver/realsass-sass-back`.
Los microservicios de este repo son **consumidores del contexto** — no dueños del modelo.

### Cómo llega el contexto de Market a cada MS

El contexto de Market se propaga como header HTTP desde el caller:

```
X-Tenant-ID:       <organizationId>     (ya existe — TenantGuard)
X-Ecosystem-ID:    <ecosystemId>        (ya existe — TenantGuard)
X-Market-Country:  CO                  (nuevo — ISO 3166-1 alpha-2)
X-Market-ID:       <marketId>          (nuevo — resuelto por ecommerce-back)
```

### Microservicio por microservicio

| MS | Uso de Market | Detalle |
|----|--------------|---------|
| `chatia-backend` | Contexto de respuesta | El agente responde con contexto del país del cliente |
| `pasarelapagos-backend` | País de la transacción | Registro de país para auditoría y reconciliación |
| `notificaciones-backend` | Localización de mensajes | Template de notificación según país |
| `analytics-backend` | Dimensión de análisis | Métricas segmentadas por Market/país |
| `workers-backend` | Contexto de jobs | Jobs de fulfillment con contexto del Market |

---

## Consecuencias

- Cada MS lee `X-Market-Country` del header — nunca lo resuelve ni lo valida
- La validación del Market ocurre upstream (ecommerce-back o sass-back)
- Si el header no llega → los MS operan sin contexto de país (comportamiento actual)
- Backward compatible — los MS existentes no rompen
EOF

echo "  ✓ ADR-014-markets-context.md"

# -----------------------------------------------------------------------------
# 2. chatia-backend — cómo usa Market
# -----------------------------------------------------------------------------
mkdir -p .claude/modules/chatia-backend

cat > .claude/modules/chatia-backend/markets.md << 'EOF'
# Markets en chatia-backend

## Rol

El agente de chat IA recibe el contexto de país del cliente para:
- Adaptar las respuestas al contexto local (ej: "enviamos desde Bogotá" en CO)
- Registrar el país en cada conversación para analytics
- Seleccionar templates de respuesta localizados (si existen)

## Cómo llega el contexto

Header `X-Market-Country: CO` en cada request de conversación.
Extraído en el TenantGuard extendido o en el ConversationController.

## Cambios necesarios

### En TenantContext (packages/auth-server)

```typescript
// types/tenant-context.ts — agregar campo opcional
export interface TenantContext {
  organizationId: string
  ecosystemId:    string
  userId:         string
  role:           Role
  marketCountry?: string   // NUEVO — ISO 3166-1 alpha-2, opcional
}
```

### En ConversationService

```typescript
// Al crear/actualizar conversación
await this.repo.saveConversation({
  ...existingFields,
  marketCountry: tenantContext.marketCountry ?? null,
})
```

### En el agente IA

Incluir `marketCountry` en el system prompt cuando esté disponible:

```typescript
const systemPrompt = marketCountry
  ? `${basePrompt}\n\nContexto geográfico del cliente: ${marketCountry}.
     Adapta las respuestas de logística y envíos a este país.`
  : basePrompt
```

## Checklist

- [ ] MKT-CH-01: Agregar `marketCountry?` a `TenantContext`
- [ ] MKT-CH-02: Extraer `X-Market-Country` en el guard/middleware
- [ ] MKT-CH-03: Guardar `marketCountry` en Conversation model (Prisma migration)
- [ ] MKT-CH-04: Inyectar en system prompt del agente
- [ ] MKT-CH-05: Dimensión `market_country` en eventos de analytics
EOF

echo "  ✓ modules/chatia-backend/markets.md"

# -----------------------------------------------------------------------------
# 3. pasarelapagos-backend — cómo usa Market
# -----------------------------------------------------------------------------
mkdir -p .claude/modules/pasarelapagos-backend

cat > .claude/modules/pasarelapagos-backend/markets.md << 'EOF'
# Markets en pasarelapagos-backend

## Rol

Pagos ya usa Stripe que maneja multi-moneda y multi-país de forma nativa.
El rol de Market aquí es de **auditoría y trazabilidad**, no de lógica de pago.

## Lo que se registra

En cada transacción se guarda el país del comprador para:
- Reconciliación contable por mercado
- Reportes de revenue por país en el superadmin
- Cumplimiento fiscal (saber en qué país ocurrió la transacción)

## Cambios en el modelo de Transaction

```prisma
model Transaction {
  // ... campos existentes ...
  marketCountry  String?  @map("market_country")  // NUEVO — ISO 3166-1 alpha-2
  // Stripe ya registra country en el PaymentIntent — esto lo espeja en nuestra DB
}
```

## Checklist

- [ ] MKT-PP-01: Migración Prisma — `marketCountry` en Transaction
- [ ] MKT-PP-02: Extraer de header `X-Market-Country` en PaymentController
- [ ] MKT-PP-03: Pasar a TransactionService al registrar pago
- [ ] MKT-PP-04: Incluir en listado interno de transacciones (para superadmin)
EOF

echo "  ✓ modules/pasarelapagos-backend/markets.md"

# -----------------------------------------------------------------------------
# 4. analytics-backend — Markets como dimensión de análisis
# -----------------------------------------------------------------------------
mkdir -p .claude/modules/analytics-backend

cat > .claude/modules/analytics-backend/markets.md << 'EOF'
# Markets en analytics-backend

## Rol

`marketCountry` es una **dimensión de segmentación** en todos los eventos de analytics.
Permite responder: "¿cuántas ventas tuve en CO este mes?" sin joins complejos.

## Cambios en el schema de eventos

```prisma
model AnalyticsEvent {
  // ... campos existentes ...
  marketCountry  String?  @map("market_country")  // NUEVO — dimensión de análisis
}
```

## Proyecciones afectadas

Las proyecciones de `ProjectionsService` deben incluir `marketCountry`
como dimensión de agrupación cuando esté disponible:

```typescript
// projections.service.ts — agregar agrupación por market
async getRevenueByMarket(organizationId: string, from: Date, to: Date) {
  return this.prisma.analyticsEvent.groupBy({
    by: ['marketCountry'],
    where: { organizationId, eventType: 'ORDER_COMPLETED', createdAt: { gte: from, lte: to } },
    _sum: { amountCents: true },
  })
}
```

## Checklist

- [ ] MKT-AN-01: Migración Prisma — `marketCountry` en AnalyticsEvent
- [ ] MKT-AN-02: Extraer de payload o header en AnalyticsController
- [ ] MKT-AN-03: `getRevenueByMarket()` en ProjectionsService
- [ ] MKT-AN-04: Endpoint gRPC para que superadmin consulte revenue por Market
EOF

echo "  ✓ modules/analytics-backend/markets.md"

# -----------------------------------------------------------------------------
# 5. packages/auth-server — TenantContext extendido
# -----------------------------------------------------------------------------
mkdir -p .claude/modules/packages

cat > .claude/modules/packages/markets-tenant-context.md << 'EOF'
# TenantContext extendido con Market

## Cambio en @ecosistema-ms/auth-server

El `TenantContext` es el contrato central que fluye por todos los microservicios.
Agregar `marketCountry` como campo opcional mantiene backward compatibility total.

```typescript
// packages/auth-server/src/types/tenant-context.ts

export interface TenantContext {
  organizationId: string    // existente
  ecosystemId:    string    // existente
  userId:         string    // existente
  role:           Role      // existente
  marketCountry?: string    // NUEVO — ISO 3166-1 alpha-2, undefined si no aplica
}
```

## Dónde se extrae

En el `TenantGuard` o en un middleware previo al guard:

```typescript
// guards/tenant.guard.ts — agregar extracción de header
const marketCountry = request.headers['x-market-country'] as string | undefined

context.set<TenantContext>('tenant', {
  ...existingFields,
  marketCountry: marketCountry?.toUpperCase() ?? undefined,
})
```

## Headers estándar

```
X-Tenant-ID:       <organizationId>   // existente
X-Ecosystem-ID:    <ecosystemId>      // existente
X-Market-Country:  CO                 // NUEVO — opcional
X-Market-ID:       <marketId>         // NUEVO — opcional, UUID del Market resuelto
```

## Checklist

- [ ] MKT-PKG-01: Agregar `marketCountry?` a TenantContext interface
- [ ] MKT-PKG-02: Extraer `X-Market-Country` en TenantGuard
- [ ] MKT-PKG-03: Bump de versión del package (minor — cambio backward compatible)
- [ ] MKT-PKG-04: Actualizar tipos en todos los MS que importan TenantContext
EOF

echo "  ✓ modules/packages/markets-tenant-context.md"

# -----------------------------------------------------------------------------
# 6. Norte en CLAUDE.md
# -----------------------------------------------------------------------------

cat >> .claude/CLAUDE.md << 'EOF'

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
EOF

echo "  ✓ CLAUDE.md actualizado"

# -----------------------------------------------------------------------------
# 7. lifecycle/tasks.md
# -----------------------------------------------------------------------------
mkdir -p .claude/lifecycle

cat >> .claude/lifecycle/tasks.md << 'EOF'

---

## Sprint Markets — ADR-014 (ecosistema-ms)

### packages/auth-server (bloqueante para todos los MS)

- [ ] MKT-PKG-01: `marketCountry?` en TenantContext
- [ ] MKT-PKG-02: Extraer X-Market-Country en TenantGuard
- [ ] MKT-PKG-03: Bump minor del package
- [ ] MKT-PKG-04: Actualizar imports en cada MS

### chatia-backend

- [ ] MKT-CH-01..05 (ver modules/chatia-backend/markets.md)

### pasarelapagos-backend

- [ ] MKT-PP-01..04 (ver modules/pasarelapagos-backend/markets.md)

### analytics-backend

- [ ] MKT-AN-01..04 (ver modules/analytics-backend/markets.md)

### notificaciones-backend / workers-backend

- [ ] Agregar marketCountry al payload de notificaciones
- [ ] Agregar marketCountry al contexto de jobs BullMQ
EOF

echo "  ✓ lifecycle/tasks.md actualizado"

echo ""
echo "✅ [ecosistema-ms] Markets documentado en .claude/"
echo ""
echo "Archivos creados/modificados:"
echo "  .claude/decisions/ADR-014-markets-context.md"
echo "  .claude/modules/chatia-backend/markets.md"
echo "  .claude/modules/pasarelapagos-backend/markets.md"
echo "  .claude/modules/analytics-backend/markets.md"
echo "  .claude/modules/packages/markets-tenant-context.md"
echo "  .claude/CLAUDE.md  (append)"
echo "  .claude/lifecycle/tasks.md  (append)"
echo ""
echo "Siguiente paso: bash x-markets-superadmin.sh (en grupojl-control/)"