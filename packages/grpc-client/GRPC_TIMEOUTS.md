# DT-013 — Timeouts gRPC — guía de aplicación

## Contexto

Ningún ClientsModule en el ecosistema tiene timeouts definidos.
Sin timeout, una llamada gRPC a un servicio caído bloquea indefinidamente.

## Valores recomendados

| Timeout | Valor | Aplicar en |
|---------|-------|-----------|
| Deadline por llamada | 5000 ms | metadata de cada llamada |
| Keepalive | 30000 ms | channelOptions |
| Keepalive timeout | 5000 ms | channelOptions |

## Aplicar en cada ClientsModule.register()

```typescript
// Ejemplo en packages/grpc-client/src/chatia/chatia-grpc.module.ts
ClientsModule.registerAsync([{
  name: CHATIA_GRPC_CLIENT,
  useFactory: (config: ConfigService) => ({
    transport: Transport.GRPC,
    options: {
      url:     config.get('CHATIA_GRPC_URL'),
      package: 'chatia',
      protoPath: PROTO_PATHS.chatia,
      channelOptions: {
        'grpc.keepalive_time_ms':              30_000,
        'grpc.keepalive_timeout_ms':            5_000,
        'grpc.keepalive_permit_without_calls':      1,
        'grpc.http2.max_pings_without_data':        0,
      },
    },
  }),
  inject: [ConfigService],
}]),
```

## Deadline por llamada individual (en el servicio que llama)

```typescript
import { Metadata } from '@grpc/grpc-js';

const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 5);

this.chatiaClient.someMethod(request, new Metadata(), { deadline }).toPromise();
```

## Archivos a tocar

- packages/grpc-client/src/chatia/chatia-grpc.module.ts
- packages/grpc-client/src/pagos/pagos-grpc.module.ts
- packages/grpc-client/src/notificaciones/notificaciones-grpc.module.ts
- packages/grpc-client/src/analytics/analytics-grpc.module.ts
- packages/grpc-client/src/workers/workers-grpc.module.ts
