# Backend Capa 3 — Controllers gRPC
# Checklist 10/10

**Score actual: 6/10**
**Score objetivo: 10/10**

## ✅ Completado

- [x] Estructura gRPC presente en todos los servicios (`src/grpc/`)
- [x] `packages/proto/proto/*.proto` — contratos definidos para los 5 servicios
- [x] `packages/grpc-client/src/` — módulos cliente para consumir cada servicio
- [x] `packages/proto/src/index.ts` — `PROTO_PATHS` dinámico dev/prod

## ⏳ Pendiente para 10/10

### Pureza de los controllers gRPC (BLOQUEANTE)
- [ ] Auditar `chatia-backend/src/grpc/` — verificar que no hay lógica de negocio
- [ ] Auditar `pasarelapagos-backend/src/pagos/pagos.grpc.controller.ts`
- [ ] Auditar `notificaciones-backend/src/grpc/notificaciones-grpc.controller.ts`
- [ ] Auditar `analytics-backend/src/grpc/analytics-grpc.controller.ts`
- [ ] Auditar `workers-backend/src/grpc/workers-grpc.controller.ts`
- [ ] Para cada controller con lógica: extraer al Service correspondiente

### Cobertura de contratos
- [ ] Verificar que todos los métodos del .proto tienen implementación en el controller
- [ ] Documentar en `contracts/grpc-contracts.md` los métodos de cada servicio

### Enforcement CI
- [ ] `dependency-cruiser` rule `no-prisma-in-grpc-controller`
  → Falla si un `*-grpc.controller.ts` importa `PrismaService`

## Regla dura

Un controller gRPC es un adaptador de transporte.
Recibe el request proto → llama al Service → retorna el response proto.
Cero lógica condicional de negocio, cero acceso a Prisma, cero acceso a Redis directo.
