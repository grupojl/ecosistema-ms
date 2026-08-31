# ADR-004 — Migracion de analytics de chatia a analytics-backend

Estado: En ejecucion (semana 6+)
Fecha: 2024-Q4

## Contexto

chatia-backend tenia su propio modulo de analytics (src/analytics/).
Se migro al microservicio dedicado analytics-backend.
El modulo legacy en chatia responde con HTTP 410 Gone durante la migracion.

## Codigo actual en chatia

// analytics.controller.ts — retorna 410 en todos los endpoints
// analytics.service.ts — placeholder vacio
// analytics-events.service.ts — producer BullMQ best-effort NUEVO

## Consecuencias

OK: AnalyticsEventsService.track() es fire-and-forget (attempts: 1)
    El chat no se degrada si analytics cae.
PENDIENTE: Eliminar AnalyticsModule y AnalyticsService de chatia (DT-011)
           cuando welver confirme migracion completa.
