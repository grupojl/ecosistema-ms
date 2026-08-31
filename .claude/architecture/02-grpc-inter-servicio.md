# Comunicación gRPC Inter-Servicio

## Cuándo usar gRPC vs HTTP vs BullMQ

| Patrón | Cuándo |
|--------|--------|
| gRPC | Llamada síncrona interna entre microservicios (baja latencia, tipado fuerte) |
| HTTP REST | Consumidores externos (welver, clientes, webhooks entrantes) |
| BullMQ | Jobs asíncronos, procesamiento en background, retries con backoff |

## Flujo de definición de contrato gRPC

1. Editar `packages/proto/proto/{servicio}.proto`
2. Regenerar tipos si aplica
3. Actualizar `packages/grpc-client/src/{servicio}/{servicio}-grpc.module.ts`
4. Implementar en el servidor: `{servicio}-grpc.controller.ts`
5. Consumir en el cliente: inyectar el módulo de `@ecosistema-ms/grpc-client`

## Variables de entorno por microservicio

```bash
# En el microservicio que LLAMA
CHATIA_GRPC_URL=chatia-backend.railway.internal:5001     # Railway prod
CHATIA_GRPC_URL=localhost:5001                            # Desarrollo local

PAGOS_GRPC_URL=pasarelapagos-backend.railway.internal:5002
NOTIF_GRPC_URL=notificaciones-backend.railway.internal:5003
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
WORKERS_GRPC_URL=workers-backend.railway.internal:5005
```

## Reglas
- gRPC solo sobre red privada Railway — nunca expuesto al público
- Timeout máximo: 10s para llamadas síncronas críticas (pagos)
- Implementar `deadline` en cada llamada gRPC cliente
- Si el servicio downstream cae → propagar error apropiado, no silenciar
