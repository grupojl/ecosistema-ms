---
name: grpc-contract
description: Cambiar un contrato gRPC (.proto) entre microservicios del monorepo sin romper a los consumidores — cambio aditivo vs breaking, cliente en packages/grpc-client, servidor en el controller gRPC, orden de despliegue. Usar cuando el usuario pida "agregar un método/campo gRPC", "cambiar el proto", "llamar a otro servicio por gRPC" o se toque packages/proto.
---

# grpc-contract

Base: `checklists/cambio-proto.md`, `contracts/grpc-contracts.md`, `architecture/02-grpc-inter-servicio.md`.
Los `.proto` viven en `packages/proto/proto/`. Los packages se consumen compilados (`dist/`), nunca `src/` (ADR-020).

## 1. Clasificar el cambio
| Tipo | Ejemplos | Camino |
|---|---|---|
| **Aditivo** | campo nuevo con número nuevo, método nuevo | proceder (ver 2) |
| **Breaking** | renombrar/eliminar/cambiar tipo, reusar un número de campo | **ADR obligatorio** + método `V2` y el viejo sigue funcionando un sprint completo (ver 3) |

## 2. Cambio aditivo
1. Editar el `.proto` (**nunca reusar números de campo**).
2. Reconstruir en orden: `pnpm --dir packages/proto build` → `auth-server` → `grpc-client`.
3. Cliente: actualizar `packages/grpc-client/src/<servicio>/<servicio>-grpc.module.ts` y su wrapper.
4. Servidor: implementar en `infrastructure/transport/grpc/<servicio>-grpc.controller.ts`
   (**delegar a un service de `core/`**; el controller gRPC no tiene lógica ni Prisma salvo lectura trivial).
5. **Convención de nombres de campo** (fuente real de bugs): los servidores cargan el proto con el valor por defecto de `keepCase` (`false` → **camelCase**),
   pero los clientes de `notificaciones` y `workers` en `packages/grpc-client` usan `keepCase: true` (**snake_case**). Si cliente y servidor no acuerdan,
   **los campos se pierden en silencio** (ya detectado en workers). Al tocar un método, verificar ambos extremos y probarlo con el `.proto` real.
6. Autenticación: `x-internal-api-key` en metadata. `GRPC_AUTH_ENFORCED=true` solo se puede activar cuando `grpcMetadata()` del cliente envíe la clave (hoy no lo hace).
7. Tests: contrato probado **con el `.proto` real** (ver `infrastructure/transport/grpc/chatia-grpc.spec.ts`), no con un objeto inventado.

## 3. Breaking
1. Crear el ADR (`decisions/ADR-0NN-…`). 2. Agregar el método `…V2` y migrar a los consumidores. 3. Comunicar a **todos** los servicios que usan el proto
(`grep -rn "<NombreServicio>" */src packages/grpc-client`). 4. Retirar el viejo recién tras el período de migración.

## 4. Despliegue (orden)
1. **Servidor primero** (el método nuevo ya existe) → 2. clientes → 3. verificar `/health/ready` de todos en Railway.

## 5. Cierre
- Skill `verify --integration` en el servicio servidor **y** en cada consumidor afectado.
- Actualizar `contracts/grpc-contracts.md` y el cambio en `deuda-tecnica.md` si queda algo a medias.
