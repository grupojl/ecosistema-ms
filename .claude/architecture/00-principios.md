# Principios de Arquitectura — ecosistema-ms

## 1. Aislamiento de dominio
Cada microservicio es dueño de su bounded context.
Nunca acceder directamente a la DB de otro servicio — solo via gRPC o HTTP.

## 2. Multi-tenancy obligatorio
`ecosystemId` + `organizationId` viajan en **todos** los requests y queries.
Una query sin estos filtros es un bug de seguridad, no solo de lógica.

## 3. Contratos primero
Los `.proto` files en `packages/proto/proto/` son la fuente de verdad para gRPC.
Cambiar un proto = ADR + versionar = nunca breaking change silencioso.

## 4. Capas estrictas (por microservicio)
```
Controller  →  solo HTTP/gRPC surface, sin lógica de negocio
Service     →  orquestación, reglas de dominio, sin detalles de infraestructura
Repository  →  Prisma queries, siempre con include explícito (N+1 = error)
Processor   →  BullMQ workers, idempotentes, con retry policy
Adapter     →  integración con terceros (Stripe, MercadoPago, Firebase...)

¿ hace falta la capa domain + repository por que ahora tenemos dtos ?
```

## 5. Idempotencia en workers
Todos los processors BullMQ deben ser idempotentes.
Usar `idempotencyKey` o `deduplication` en jobs críticos (pagos, notificaciones).

## 6. Circuit breaker en adapters externos
Todo adapter de proveedor externo (pasarela de pago, email, WhatsApp)
implementa circuit breaker para evitar cascada de fallos.

## 7. Health checks homogéneos
Cada microservicio expone `GET /health` con checks de: DB, Redis, gRPC downstream.
Railway usa este endpoint para health checks de deploy.

## 8. Observabilidad desde el día 1
- Structured logging con `nestjs-pino` (JSON en producción)
- Métricas Prometheus en `GET /metrics`
- Tracing OpenTelemetry (en S4)
