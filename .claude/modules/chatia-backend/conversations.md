# Módulo: conversations (MOLDE VIVO — pendiente de migración)

## ¿Qué hace?

Gestiona el ciclo de vida completo de las conversaciones entre clientes
y los agentes IA de una organización.

## Invariantes de dominio (a implementar en domain/)

- Una conversación no puede volver a `OPEN` desde `CLOSED`
- Solo el `assignedAgentId` puede responder en una conversación `ASSIGNED`
- El `soft-delete` no elimina los mensajes — solo marca la conversación
- Los tags son un set — no pueden duplicarse en la misma conversación

## Estado actual

⚠️ `conversations.service.ts` llama `PrismaService` directamente.
**Pendiente: migrar a Domain + Repository — ver ADR-002.**
Este módulo será el MOLDE VIVO para todos los demás.

## Funciones principales

- `create` — crear conversación con ecosystemId + organizationId obligatorios
- `list` — listar con filtros (status, tags, agente asignado)
- `assign` — asignar agente a conversación
- `resolve` — cerrar conversación
- `softDelete` / `restore`
- `addTag` / `removeTag`

## Dependencias

- `PrismaService` (hoy directo — migrar a `IConversationsRepository`)
- `AnalyticsEventsService` — emite eventos al analytics-backend
