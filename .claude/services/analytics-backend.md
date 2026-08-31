# Servicio: analytics-backend

## Rol
Ingestion de eventos, proyecciones nocturnas con lock Redis correcto,
SSE para dashboard en tiempo real, exportacion async.

## Puertos
- HTTP: 3003
- gRPC: 5004

## Score actual: 7.8/10

| Area | Estado |
|------|--------|
| Ingestion de eventos (gRPC TrackEvent) | OK |
| Proyecciones rolling con SET NX EX Redis | OK — lock CORRECTO |
| SSE multi-pod via Redis pub/sub | OK — heartbeat 25s |
| MAX_SSE_CONNECTIONS configurable | OK |
| Export async (BullMQ -> workers) | OK |
| Export con chunking para >100MB | SIN chunking — limite hardcodeado |
| Tests | 0 tests — DT-001 |
| Metricas Prometheus reales | MetricsService existe sin exporter |

## Nota: este MS tiene el lock distribuido CORRECTO

SET NX EX de Redis en projections.service.ts.
Copiar este patron a workers-backend (DT-005).

## Variables de entorno

DATABASE_URL=
REDIS_URL=
FIREBASE_PROJECT_ID=
PORT=3003
GRPC_PORT=5004
MAX_SSE_CONNECTIONS=100
FORCE_PROJECTION_RUN=false
