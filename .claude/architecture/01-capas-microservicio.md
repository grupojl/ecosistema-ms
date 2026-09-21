# Capas por Microservicio

## Estructura de carpetas canónica
```
{servicio}-backend/
  src/
    {dominio}/
      dto/              # Contratos de entrada/salida (class-validator)
      processors/       # BullMQ workers del dominio
      adapters/         # Integraciones externas
      interfaces/       # Tipos internos del dominio
      {dominio}.controller.ts
      {dominio}.module.ts
      {dominio}.service.ts
      {dominio}.constants.ts
    grpc/
      grpc.module.ts
      {servicio}-grpc.controller.ts   # Surface gRPC interna
    health/
      health.controller.ts
      health.module.ts
    metrics/
      metrics.module.ts
      metrics.service.ts
    prisma/
      prisma.module.ts
      prisma.service.ts
    app.module.ts
    main.ts
  prisma/
    schema.prisma
  Dockerfile
  package.json
  tsconfig.json
```

## Reglas por capa

### Controller (HTTP)
- Solo recibe, valida DTO, llama al service, retorna
- No contiene lógica condicional de negocio
- Decoradores: `@ApiTags`, `@ApiBearerAuth`, `@UseGuards(AuthGuard, TenantGuard)`
- Toda ruta autenticada lleva `@UseGuards` — nunca confiar en el orden del módulo

### Controller (gRPC)
- Solo expone métodos definidos en el `.proto`
- Prefijo `{Servicio}GrpcController`
- No reutilizar el mismo controller HTTP — son surfaces distintas

### Service
- Lógica de dominio, validaciones de negocio, orquestación
- Puede llamar a otros services del mismo microservicio
- Para llamar a otro microservicio: via `GrpcClient` inyectado
- Manejo de errores tipado: nunca `throw new Error('mensaje')` — usar excepciones NestJS

### Processor (BullMQ)
- Extiende `WorkerHost`, decora con `@Processor(QUEUE_NAME)`
- Idempotente: el mismo job corrido N veces produce el mismo resultado
- Registra `onFailed` con logging estructurado
- Usa `job.attemptsMade` para lógica de reintentos diferenciada

### Adapter
- Una clase por proveedor externo
- Implementa la interface del dominio, no la del proveedor
- Circuit breaker obligatorio si el proveedor es crítico
- Nunca exponer tipos del SDK del proveedor fuera del adapter

## marketing-backend — estructura de dominio

```
marketing-backend/
  src/
    ad-accounts/
      adapters/
        meta-ads.adapter.ts         # Circuit breaker obligatorio
        google-ads.adapter.ts       # Circuit breaker obligatorio
        tiktok-ads.adapter.ts       # Circuit breaker obligatorio
      interfaces/
        ad-platform.interface.ts    # Contrato que todos los adapters implementan
      ad-accounts.controller.ts
      ad-accounts.service.ts
      ad-accounts.module.ts
    campaigns/
      domain/
        campaign.entity.ts
        automation-rule.entity.ts   # { metric, operator, value, windowDays } → acción
        campaign.errors.ts
      repository/
        campaigns.repository.interface.ts
        prisma-campaigns.repository.ts
      processors/
        automation-check.processor.ts   # Queue: campaign-automation
        sync-metrics.processor.ts       # Queue: campaign-sync
      campaigns.controller.ts
      campaigns.service.ts
      campaigns.module.ts
    attribution/
      processors/
        attribute-conversion.processor.ts  # Queue: marketing-attribution
      attribution.service.ts
      attribution.module.ts
    internal/
      internal-api-key.guard.ts     # mismo molde que chatia/pagos/workers
      internal.controller.ts        # /internal/campaigns, /internal/metrics/summary
      internal.module.ts
    grpc/
      marketing-grpc.controller.ts
    health/
    metrics/
    prisma/
    app.module.ts
    main.ts
  prisma/
    schema.prisma
  Dockerfile
  railway.json
  package.json
  tsconfig.json
```

### Adapters — regla de circuit breaker

Todos los adapters de plataformas (Meta, Google, TikTok) tienen circuit breaker
obligatorio con `opossum`. Si el CB está abierto:
- `SyncMetricsProcessor` → loguea + emite alerta a notificaciones-backend (fire-forget)
- `AutomationCheckProcessor` → postpone la revisión 15 min (BullMQ delay)
- Nunca lanza excepción que bloquee el job principal

### Invariante multi-tenant en marketing-backend

Todo query Prisma lleva `ecosystemId` + `organizationId`.
`attribution` también: un payment de org-A jamás se atribuye a org-B.
