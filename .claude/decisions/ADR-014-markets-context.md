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
