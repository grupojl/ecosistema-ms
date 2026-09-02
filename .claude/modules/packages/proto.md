# Package: @ecosistema-ms/proto

## ¿Qué hace?

Centraliza los archivos `.proto` y exporta las rutas absolutas a los mismos
(necesarias para que `@nestjs/microservices` los encuentre en cualquier entorno).

## Archivos .proto

| Archivo | Servicio que implementa | Consumidores |
|---------|------------------------|--------------|
| `chatia.proto` | `chatia-backend` | workers, welver |
| `pagos.proto` | `pasarelapagos-backend` | welver, chatia |
| `notificaciones.proto` | `notificaciones-backend` | chatia, workers |
| `analytics.proto` | `analytics-backend` | todos |
| `workers.proto` | `workers-backend` | chatia |

## Cómo agregar un nuevo RPC

1. Editar el `.proto` del servicio
2. Compilar (si hay generación de código TS — verificar si está configurado)
3. Actualizar `packages/grpc-client/src/<servicio>/`
4. Implementar en el controller gRPC del servicio
5. Documentar en `contracts/grpc-contracts.md`
