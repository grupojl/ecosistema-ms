# Servicio: notificaciones-backend

## Rol
Hub de notificaciones multicanal — WhatsApp, Email y Push.
Deduplicacion con idempotencyKey en DB + Redis, DLQ con monitor automatico.

## Puertos
- HTTP: 3002
- gRPC: 5003

## Score actual: 6.5/10

| Area | Estado |
|------|--------|
| Deduplicacion (idempotencyKey @@unique + Redis) | OK |
| Opt-out check antes de enviar | OK — ContactPreference |
| 3 processors (WhatsApp, Email, Push) | OK — BaseNotificationProcessor |
| DLQ monitor con threshold | OK — alerta a chatia via gRPC si >100 items |
| Preferencias de canal (gRPC) | OK — UpdateContactPreference |
| Circuit Breaker en adapters | NINGUNO de los 3 canales — DT-004 |
| Metricas de tasa de entrega | Sin open rate, sin delivery rate |
| Tests | 0 tests — DT-001 |
| @ts-expect-error en dlq-monitor | Tipado gRPC incorrecto — DT-008 |

## Flujo de notificacion

gRPC SendNotification (o HTTP POST /notifications)
  -> NotificationsService.enqueue()
  -> BullMQ queue por canal
  -> BaseNotificationProcessor.process()
    -> 1. dedup check (idempotencyKey en Redis)
    -> 2. opt-out check (ContactPreference)
    -> 3. upsert PENDING en DB
    -> 4. resolve recipient
    -> 5. adapter.send() <- SIN CB HOY
    -> 6. upsert SENT o FAILED

## Variables de entorno

DATABASE_URL=
REDIS_URL=
FIREBASE_PROJECT_ID=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
FCM_PROJECT_ID=
DLQ_WARN_THRESHOLD=50
DLQ_ALERT_THRESHOLD=100
PORT=3002
GRPC_PORT=5003
CHATIA_GRPC_URL=chatia-backend.railway.internal:5001
