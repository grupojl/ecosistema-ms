# Packages compartidos — @ecosistema-ms/*

## Estado: TODOS BLOQUEANTES

Los tres packages son invariantes de arquitectura.
No se modifican sin ADR previo.

| Package | Nombre pkg | Rol | Clasificación |
|---------|-----------|-----|---------------|
| `packages/proto` | `@ecosistema-ms/proto` | Contratos gRPC (.proto + PROTO_PATHS) | 🔴 BLOQUEANTE |
| `packages/auth-server` | `@ecosistema-ms/auth-server` | Guards, decorators, TenantContext | 🔴 BLOQUEANTE |
| `packages/grpc-client` | `@ecosistema-ms/grpc-client` | Módulos cliente gRPC | 🔴 BLOQUEANTE (estructura) · 🟢 DINÁMICA (agregar módulos) |

## Reglas por package

### packages/proto
- Agregar un nuevo `.proto` requiere: actualizar `packages/grpc-client` + el controller del servicio
- Modificar un `.proto` existente (cambiar campos) rompe compilación — es intencional
- `src/index.ts` — lógica de PROTO_PATHS no se toca sin ADR

### packages/auth-server
- La interface de `TenantContext` es 🔴 BLOQUEANTE — cambiarla afecta todos los servicios
- Los decorators (`@Public()`, `@Tenant()`) son 🔴 BLOQUEANTE
- Agregar un nuevo decorator es 🟢 DINÁMICA si no modifica los existentes

### packages/grpc-client
- La estructura de cada módulo cliente es 🔴 BLOQUEANTE (cómo se instancia el cliente)
- Agregar un módulo para un nuevo servicio es 🟢 DINÁMICA (sigue el mismo patrón)
