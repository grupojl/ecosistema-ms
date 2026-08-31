# Servicio: workers-backend

## Rol
Motor de jobs BullMQ — embeddings, indices vectoriales, emails de campanas,
exports de analytics. Scheduler de campanas con cron y JobLog en DB.

## Puertos
- HTTP: 3004
- gRPC: 5005

## Score actual: 7.0/10

| Area | Estado |
|------|--------|
| Processors (vector, faq, campaign, export) | OK |
| JobLog en DB (ecosystemId + organizationId) | OK |
| CircuitBreakerService en jobs | OK |
| DLQ controller (replay manual) | OK |
| Scheduler de campanas con cron | OK |
| Lock distribuido del scheduler | SIMPLIFICADO — no es Redlock real (DT-005) |
| CampaignRecipient table | NO EXISTE — recipientIds=[] en produccion (DT-003) |
| Tests | 0 tests — DT-001 |

## DEUDA CRITICA: DT-003

Campaign.recipientIds = [] en produccion.
Las campanas de email masivo no envian a nadie real.
Crear tabla CampaignRecipient antes del siguiente go-live.

## Variables de entorno

REDIS_URL=
DATABASE_URL=
FIREBASE_PROJECT_ID=
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
CHATIA_GRPC_URL=chatia-backend.railway.internal:5001
PORT=3004
GRPC_PORT=5005
