# Contrato: gRPC inter-servicio

## Servicios y sus contratos

| .proto | Servicio que lo implementa | Puerto gRPC |
|--------|---------------------------|-------------|
| `chatia.proto` | `chatia-backend` | 5001 |
| `pagos.proto` | `pasarelapagos-backend` | 5002 |
| `notificaciones.proto` | `notificaciones-backend` | 5003 |
| `analytics.proto` | `analytics-backend` | 5004 |
| `workers.proto` | `workers-backend` | 5005 |

## Cómo agregar un nuevo RPC

1. Editar `packages/proto/proto/<servicio>.proto` — agregar el `rpc` y los `message`
2. Implementar el método en el `*-grpc.controller.ts` del servicio
3. Actualizar `packages/grpc-client/src/<servicio>/<servicio>-grpc.module.ts`
4. El servicio consumidor importa el módulo cliente y lo inyecta en su módulo

## Cómo consume un servicio a otro

```ts
// En el módulo del servicio consumidor:
import { ChatIAGrpcModule } from '@ecosistema-ms/grpc-client';

@Module({
  imports: [ChatIAGrpcModule],
})
export class MiModulo {}

// En el servicio:
@Injectable()
export class MiService {
  constructor(
    @Inject('CHATIA_GRPC_CLIENT') private chatia: ClientGrpc
  ) {}
}
```

## Regla de degradación (decidir por servicio)

Cada par consumidor→proveedor debe tener documentado:
- Timeout configurado (no indefinido)
- Comportamiento en timeout: rechazar con 503 | reintentar | degradar con cache
- Estado: ¿documentado? ¿implementado? ¿testeado?

| Consumidor | Proveedor | Timeout | Fallback | Estado |
|---|---|---|---|---|
| `workers-backend` | `chatia-backend` | ⚠️ pendiente | ⚠️ pendiente | pendiente |
| `notificaciones-backend` | `chatia-backend` | ⚠️ pendiente | ⚠️ pendiente | pendiente |
| `analytics-backend` | (todos) | ⚠️ pendiente | ⚠️ pendiente | pendiente |
