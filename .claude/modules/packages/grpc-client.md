# Package: @ecosistema-ms/grpc-client

## ¿Qué hace?

Exporta módulos NestJS listos para usar que encapsulan la configuración del
cliente gRPC para cada microservicio. Los servicios consumidores importan el
módulo y reciben el cliente correctamente configurado.

## Módulos disponibles

| Módulo | Importar como |
|--------|---------------|
| `ChatIAGrpcModule` | `@ecosistema-ms/grpc-client` |
| `PagosGrpcModule` | `@ecosistema-ms/grpc-client` |
| `NotificacionesGrpcModule` | `@ecosistema-ms/grpc-client` |
| `AnalyticsGrpcModule` | `@ecosistema-ms/grpc-client` |
| `WorkersGrpcModule` | `@ecosistema-ms/grpc-client` |

## Cómo usar

```ts
@Module({
  imports: [AnalyticsGrpcModule],
})
export class MiModulo {}
```

## Cómo agregar un módulo cliente nuevo

1. Crear `src/<servicio>/<servicio>-grpc.module.ts` siguiendo el patrón de los existentes
2. Exportar desde `src/index.ts`
3. La variable de entorno del URL debe ser `{SERVICIO}_GRPC_URL`
