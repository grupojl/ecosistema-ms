# Comunicación inter-servicio — gRPC

## Principio

Los .proto files son el contrato entre microservicios.
Son la fuente de verdad — no se duplica la definición en TypeScript.

## Ubicación de los contratos

```
packages/proto/proto/
  analytics.proto        # AnalyticsService
  chatia.proto           # ChatIAService
  notificaciones.proto   # NotificacionesService
  pagos.proto            # PagosService
  workers.proto          # WorkersService

packages/proto/src/index.ts   # exporta PROTO_PATHS — ruta dinámica dev/prod
packages/grpc-client/src/     # módulos NestJS para consumir cada servicio
  analytics/analytics-grpc.module.ts
  chatia/chatia-grpc.module.ts
  notificaciones/notificaciones-grpc.module.ts
  pagos/pagos-grpc.module.ts
  workers/workers-grpc.module.ts
```

## Variables de entorno gRPC

| Variable | Local | Railway (red privada) |
|---|---|---|
| `CHATIA_GRPC_URL` | `localhost:5001` | `chatia-backend.railway.internal:5001` |
| `PAGOS_GRPC_URL` | `localhost:5002` | `pasarelapagos-backend.railway.internal:5002` |
| `NOTIFICACIONES_GRPC_URL` | `localhost:5003` | `notificaciones-backend.railway.internal:5003` |
| `ANALYTICS_GRPC_URL` | `localhost:5004` | `analytics-backend.railway.internal:5004` |
| `WORKERS_GRPC_URL` | `localhost:5005` | `workers-backend.railway.internal:5005` |

## Cómo agregar un nuevo RPC

1. Editar el `.proto` correspondiente en `packages/proto/proto/`
2. Agregar el método al controller gRPC del servicio que lo expone
3. Actualizar `packages/grpc-client/src/<servicio>/<servicio>-grpc.module.ts`
4. El consumer importa el módulo desde `@ecosistema-ms/grpc-client`

**Regla:** Nunca llamar a otro servicio por HTTP si existe el .proto.
Si el .proto no existe aún, documentar con `// TODO(grpc): crear .proto cuando...`

## Patrón de controller gRPC correcto

```ts
// ✅ CORRECTO — controller gRPC como proxy puro
@GrpcMethod('ChatIAService', 'SendMessage')
async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
  // Solo transforma el proto request → llamada al service
  const result = await this.conversationsService.sendMessage({
    ecosystemId:    data.ecosystemId,
    organizationId: data.organizationId,
    conversationId: data.conversationId,
    content:        data.content,
  });
  return { messageId: result.id, createdAt: result.createdAt.toISOString() };
}

// ❌ PROHIBIDO — lógica de negocio en el controller gRPC
@GrpcMethod('ChatIAService', 'SendMessage')
async sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
  if (data.content.length > 1000) throw new RpcException('too long'); // ← va en el Service
  const conversation = await this.prisma.conversation.findFirst(...); // ← va en el Repository
  // ...
}
```

## Regla dura

Un controller gRPC que importa `PrismaService` o tiene lógica condicional de
negocio es un bug de arquitectura. El controller gRPC es un adaptador de
transporte, no un service.
