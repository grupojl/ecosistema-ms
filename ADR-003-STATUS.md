# ADR-003 — Estado final de implementación

**Fecha cierre:** $(date +"%Y-%m-%d")
**Estado:** ✅ IMPLEMENTADO

---

## Microservicios extraídos de chatia-backend

| Servicio | Puerto HTTP | Puerto gRPC | Estado |
|---|---|---|---|
| `notificaciones-backend` | 3002 | 5003 | ✅ Production-ready |
| `analytics-backend`      | 3003 | 5004 | ✅ Production-ready |
| `workers-backend`        | 3004 | 5005 | ✅ Production-ready |

## Semanas completadas

| Semana | Tickets | Estado |
|---|---|---|
| 1 | N-1 scaffold notif + A-1 scaffold analytics | ✅ |
| 2 | N-2 WhatsApp+Email + W-1 FAQ ingest | ✅ |
| 3 | N-2 cierre + A-2 queries + W-1 cierre | ✅ |
| 4 | N-3 push+métricas + A-2 API + W-2 vectores+campañas | ✅ |
| 5 | N-3.4 observabilidad + A-3 proyecciones+SSE + W-3 hardening | ✅ |
| 6 | Extracción final chatia + wiring completo | ✅ |
| 7 | ConversationsService analytics + cleanup deprecated | ✅ |

## Invariantes cumplidas

- ✅ Tráfico operacional de chat nunca se degrada por analytics o jobs batch
- ✅ Un mensaje nunca se envía dos veces (idempotencyKey)
- ✅ Un job fallido nunca se pierde (DLQ + retry + JobLog)
- ✅ Analytics queries nunca tocan la DB operacional de chatia en producción

## ADRs derivados pendientes

- ADR-004: Retry y dead letter queue para notificaciones fallidas
- ADR-005: Réplica PG vs proyecciones materializadas en Redis
- ADR-006: Vector store — pgvector vs Qdrant
