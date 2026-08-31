# Módulo: conversations (chatia-backend)

## Responsabilidad
Lifecycle completo de conversaciones: apertura, cierre, transferencia entre agentes.

## Estados de conversación
`OPEN` → `PENDING` → `CLOSED` | `TRANSFERRED`

## Invariantes de dominio
- Una conversación pertenece a exactamente una organización y un canal
- Solo usuarios con rol ADMIN+ pueden transferir conversaciones
- Al cerrar, se emite evento `conversation.closed` a analytics-backend

## Endpoints HTTP
| Método | Path | Descripción |
|--------|------|-------------|
| GET | `/conversations` | Listar con paginación |
| GET | `/conversations/:id` | Detalle |
| POST | `/conversations/:id/close` | Cerrar conversación |
| POST | `/conversations/:id/transfer` | Transferir a agente |

## Jobs asociados
- `incoming-message` → puede crear nueva conversación si no existe
- `outgoing-message` → envía mensaje al canal externo

## Queries críticas (N+1 watch)
```typescript
// ✅ Siempre include explícito
prisma.conversation.findMany({
  where:   { ecosystemId, organizationId },
  include: { messages: { take: 1, orderBy: { createdAt: 'desc' } }, contact: true },
  orderBy: { updatedAt: 'desc' },
  take:    limit,
  skip:    offset,
});
```
