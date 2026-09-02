# workers-backend — Servicio de Workers

## Rol
Ejecución de jobs asíncronos BullMQ: campañas de mensajería,
indexación de vectores para RAG, DLQ monitoring.

## Puertos
- HTTP interno: 3004
- gRPC interno: 5005

## Clasificación de carpetas

### 🔴 BLOQUEANTES

| Carpeta | Razón |
|---------|-------|
| `src/prisma/` | Infraestructura core |
| `src/grpc/` | Entry point gRPC |
| `src/health/` | Railway healthcheck |
| `src/dlq/` | Dead Letter Queue monitoring — no simplificar sin ADR |
| `src/jobs/processors/` | Procesadores BullMQ — la interfaz de jobs es el contrato con los productores |

### 🟡 DINÁMICA CONTROLADA

| Carpeta | Regla |
|---------|-------|
| `src/jobs/processors/` | Nuevos processors siguen el mismo patrón. La interface de job (DTO de payload) debe estar en `jobs/dto/` y ser compatible con el productor. |

### 🟢 DINÁMICAS

| Carpeta | Estado |
|---------|--------|
| `src/campaigns/` | Domain/Repository pendiente |
| `src/jobs/dto/` | Migrar a Zod (son DTOs de payload de BullMQ, no de controllers REST) |
