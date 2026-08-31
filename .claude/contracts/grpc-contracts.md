# Contratos gRPC

## Protos disponibles
Todos en `packages/proto/proto/`:

| Archivo | Servicio gRPC | Métodos principales |
|---------|--------------|---------------------|
| `chatia.proto` | `ChatiaService` | `GetConversation`, `ListConversations`, `SendMessage` |
| `pagos.proto` | `PagosService` | `CreatePayment`, `GetPayment`, `GetTenantConfig` |
| `notificaciones.proto` | `NotificacionesService` | `SendNotification`, `GetPreferences` |
| `analytics.proto` | `AnalyticsService` | `PersistEvent`, `GetOverview`, `GetAgentMetrics` |
| `workers.proto` | `WorkersService` | `EnqueueJob`, `GetJobStatus`, `GetQueueStats` |

## Proceso para cambiar un proto

1. **Nunca breaking change** sin deprecation period de 1 sprint
2. Agregar campos nuevos con números de campo nuevos (protobuf es aditivo)
3. Si hay breaking change → nuevo método con sufijo `V2` + ADR
4. Actualizar `packages/grpc-client` con el nuevo módulo cliente
5. Deploy en orden: primero el servidor, luego los clientes

## Resolución de paths en Railway

El `Dockerfile` de cada microservicio copia los protos:
```dockerfile
COPY packages/proto/proto ./proto
```

`packages/proto/src/index.ts` detecta automáticamente si está en dev o en Railway runner.

## Timeouts recomendados

| Tipo de operación | Timeout |
|-------------------|---------|
| Consulta simple | 3s |
| Operación de pago | 10s |
| Ingestión de documentos | 30s |
| Export async (solo enqueue) | 5s |
