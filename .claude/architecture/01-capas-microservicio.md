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
