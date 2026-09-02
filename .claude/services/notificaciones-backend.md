# notificaciones-backend — Servicio de Notificaciones

## Rol
Envío de notificaciones multicanal (Email, Push, WhatsApp),
idempotencia, DLQ (Dead Letter Queue), preferencias de usuario.

## Puertos
- HTTP interno: 3002
- gRPC interno: 5003

## Clasificación de carpetas

### 🔴 BLOQUEANTES

| Carpeta | Razón |
|---------|-------|
| `src/prisma/` | Infraestructura core |
| `src/grpc/` | Entry point gRPC — contrato con el exterior |
| `src/health/` | Railway healthcheck |
| `src/metrics/` | Prometheus |
| `src/notifications/interfaces/notification-channel.interface.ts` | Interface de canales — cambiarla rompe los 3 adapters |
| `src/notifications/dedup/` | Idempotencia — no modificar sin entender el impacto |
| `src/notifications/dlq/` | Dead Letter Queue — no simplificar sin ADR |
| `src/notifications/circuit-breaker.service.ts` | Resiliencia — compartida entre canales |

### 🟡 DINÁMICA CONTROLADA

| Carpeta | Regla |
|---------|-------|
| `src/notifications/channels/` | Nuevos canales siguen `notification-channel.interface.ts`. No se modifica la interface sin ADR. |

### 🟢 DINÁMICAS

| Carpeta | Estado |
|---------|--------|
| `src/notifications/` (lógica principal) | Domain/Repository pendiente |
| `src/preferences/` | CRUD de preferencias — Domain/Repository pendiente |
