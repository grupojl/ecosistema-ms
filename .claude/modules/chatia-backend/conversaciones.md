# Modulo: conversaciones (chatia-backend)

## Que hace en palabras simples

Es el nucleo del chat. Cuando alguien escribe por WhatsApp, Instagram o el
widget de la web, llega aqui. El sistema decide si lo atiende la IA o un
agente humano, lleva el historial, y sabe cuando la conversacion termino.

## A quien le sirve

Al agente del equipo que revisa chats desde el dashboard. Y al contacto
(cliente) que escribio desde cualquier canal.

## Como funciona

1. Webhook del canal (WhatsApp, IG...) llega a `WebhooksController`
2. Se encola en `incoming-messages` (BullMQ)
3. `IncomingMessageProcessor` crea o retoma una `Conversation`
4. Si `isAiActive: true` → el mensaje va al `AssistantChatService` (Groq)
5. Si `stage = HUMAN_TAKEOVER` → el agente responde manualmente
6. La respuesta sale por `outgoing-messages` queue

## Estados de una conversacion

OPEN → en curso (IA o agente)
PENDING → esperando agente disponible
CLOSED → resuelta
HUMAN_TAKEOVER → IA desactivada, agente al mando

La transicion OPEN→CLOSED debe validarse con state machine (pendiente — ver checklist capa 3).

## Asignacion automatica

`AssignmentService` usa dos estrategias:
- `round-robin` — distribuye en orden entre agentes disponibles
- `least-load` — asigna al agente con menos conversaciones OPEN activas (default)

La estrategia se configura por organizacion.

## Estado actual

OK — funcional en produccion.
Sin state machine formal para transiciones invalidas.
Sin tests unitarios de AssignmentService.
