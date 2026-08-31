# notificaciones-backend — Hub de notificaciones multicanal

## Que hace en palabras simples

Envia mensajes al usuario correcto, por el canal correcto, una sola vez.
No importa si el usuario esta en WhatsApp, tiene la app instalada, o prefiere email.

El sistema respeta las preferencias del usuario (si dijo que no quiere emails,
no le manda emails) y nunca envia el mismo mensaje dos veces aunque se llame
dos veces con los mismos datos.

## A quien le sirve

A todos los demas microservicios que necesitan notificar a un contacto.
chatia lo usa para alertar a agentes de nuevas conversaciones.
pasarelapagos lo puede usar para notificar resultados de pago.

## Canales disponibles

- **WhatsApp** — via WhatsApp Business API
- **Email** — via SendGrid (o SMTP configurable)
- **Push** — via Firebase Cloud Messaging

## La garantia de "una sola vez"

Cada notificacion tiene un `idempotencyKey` unico (hash del evento + contacto + ventana de tiempo).
Antes de enviar, el sistema verifica en Redis si ya proceso esa key en las ultimas 24h.
Si ya la proceso → marca como SKIPPED, no envia.

## El monitor de DLQ

Cada 5 minutos el sistema revisa cuantas notificaciones fallidas hay acumuladas.
- Si supera 50 → log de warning
- Si supera 100 → alerta automatica al equipo via gRPC a chatia

## Estado actual

OK — multicanal funcional con deduplicacion.
Sin circuit breaker en los adapters de canal (DT-004).
