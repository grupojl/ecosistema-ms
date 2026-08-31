# Packages compartidos — @ecosistema-ms/*

## @ecosistema-ms/proto
**Carpeta**: `packages/proto/`

Fuente de verdad de los contratos gRPC.

```
packages/proto/
  proto/
    chatia.proto
    pagos.proto
    notificaciones.proto
    analytics.proto
    workers.proto
  src/
    index.ts    # Resuelve path a los .proto en dev y en Railway runner
```

**Regla crítica**: los `.proto` se copian a `{WORKDIR}/proto/` en el Dockerfile.
`src/index.ts` usa `process.cwd()` para resolver el path en ambos entornos.

---

## @ecosistema-ms/auth-server
**Carpeta**: `packages/auth-server/`

Guards, decorators y TenantContext para NestJS.

- `TenantGuard` — verifica Firebase token + extrae `ecosystemId` y `organizationId`
- `@Public()` — decorator para rutas sin auth (health, webhooks con firma propia)
- `@Tenant()` — decorator para inyectar `TenantContext` en controller params

---

## @ecosistema-ms/grpc-client
**Carpeta**: `packages/grpc-client/`

Módulos NestJS listos para inyectar en cualquier microservicio como cliente gRPC.

```
src/
  chatia/chatia-grpc.module.ts
  pagos/pagos-grpc.module.ts
  notificaciones/notificaciones-grpc.module.ts
  analytics/analytics-grpc.module.ts
  workers/workers-grpc.module.ts
  index.ts
```

Uso en un microservicio:
```typescript
import { ChatiaGrpcModule } from '@ecosistema-ms/grpc-client';

@Module({ imports: [ChatiaGrpcModule] })
export class MiModulo {}
```
