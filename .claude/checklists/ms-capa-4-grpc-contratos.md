# Capa 4 — Contratos gRPC: protos como fuente de verdad
# Checklist 10/10

**Score actual: 8.2/10 — nivel Google internal (arquitectura)**
**Score objetivo: 10/10**

## Completado

- [x] 5 protos en `packages/proto/proto/` — uno por microservicio
- [x] Todos los protos tienen `Ping` para health check inter-servicio
- [x] `ecosystemId` + `organizationId` en todos los mensajes de dominio
- [x] `packages/grpc-client/` con modulos NestJS listos para inyectar
- [x] Path resolution dev/prod en `packages/proto/src/index.ts`
  (usa `process.cwd()` — funciona en Railway runner y en local)
- [x] `ChatIaService`, `PagosService`, `NotificacionesService`,
  `AnalyticsService`, `WorkersService` — contratos completos
- [x] gRPC solo sobre red privada Railway — puertos no expuestos al publico

## Pendiente para 10/10

### Tipado del cliente gRPC (S1)
- [ ] `notificaciones-backend/src/notifications/dlq/dlq-monitor.service.ts`
  tiene `// @ts-expect-error — rxjs interop` — DT-008
  Resolver con tipado correcto del observable: `firstValueFrom(client.notifySystem(req))`

### Versioning semantico de protos (S3)
- [ ] Definir convencion: cambio aditivo vs breaking
  - Aditivo (nuevo campo, nuevo metodo): OK sin version
  - Breaking: nuevo metodo con sufijo `V2`, deprecar el anterior
- [ ] Documentar en `contracts/grpc-contracts.md` con ejemplos concretos

### Tests de contratos gRPC (S3)
- [ ] Test: `AnalyticsService.TrackEvent` con ecosystemId invalido → error gRPC
- [ ] Test: `PagosService.Ping` → responde en menos de 1s
- [ ] Test: cliente con URL incorrecta → error tipado, no exception generica

### mTLS entre servicios (S5)
- [ ] Railway private network ya protege el trafico — mTLS es una capa adicional
- [ ] Evaluar si el riesgo justifica la complejidad operacional

### Enforcement CI (S3)
- [ ] Script que verifica que todos los metodos del .proto tienen
  implementacion en el GrpcController del MS correspondiente
- [ ] Falla si hay un metodo en el proto sin implementar

## Regla dura

Cambiar un campo existente en un .proto (renombrar, cambiar tipo, cambiar numero)
es un breaking change que requiere ADR. Agregar campos nuevos con numeros nuevos
es siempre seguro — protobuf es aditivo hacia adelante.
