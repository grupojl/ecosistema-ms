# notificaciones-backend — Panel de módulos

## ¿Qué es?

Servicio de notificaciones multicanal. Recibe solicitudes de notificación
via gRPC, las enruta al canal correcto (Email, Push, WhatsApp), gestiona
idempotencia y DLQ para reintentos.

## Canales implementados

- `email/` — Email adapter
- `push/` — Push notification adapter
- `whatsapp/` — WhatsApp adapter

## Estado actual

⚠️ Sin Domain/Repository en `notifications/` ni `preferences/`.
La interface de canales (`notification-channel.interface.ts`) es BLOQUEANTE.
