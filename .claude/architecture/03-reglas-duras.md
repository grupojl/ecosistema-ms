# Reglas duras — checklist de code review

## Severidades

- 🔴 BLOQUEANTE — no se mergea hasta resolver
- 🟡 WARNING — se mergea con ticket de deuda abierto
- 🔵 CONVENCIÓN — se comenta en PR pero no bloquea

---

## Backend — todas las reglas aplican a los 5 microservicios

### 🔴 Ningún servicio reimplementa firebaseAuth/tenantContext a mano
Usar los guards de `@ecosistema-ms/auth-server`.
→ Enforcement objetivo: `dependency-cruiser` rule `no-local-firebase-verify`
→ Estado: manual (pendiente)

### 🔴 Cero DTOs nuevos con class-validator
Todo input nuevo = schema Zod colocado inline en el controller REST.
Los controllers gRPC no necesitan Zod (protobuf valida el transporte).
→ Enforcement objetivo: ESLint rule `@ecosistema-ms/no-new-class-validator`
→ Estado: BLOQUEANTE activo — ver ADR-001

### 🔴 Todo query Prisma lleva ecosystemId + organizationId en el where
Un query sin scope es filtración de datos entre clientes.
→ Enforcement objetivo: ESLint rule `@ecosistema-ms/no-unscoped-prisma-query`
→ Estado: manual — revisión obligatoria en PR

### 🔴 Ningún service importa PrismaService directamente (post-migración)
Una vez que un módulo migra a Repository, el service no puede importar Prisma.
→ Enforcement objetivo: `dependency-cruiser` rule `no-prisma-in-service`
→ Estado: no aplica aún — Domain/Repository pendiente en todos los servicios

### 🔴 Ningún import cruza la frontera entre microservicios
Un servicio solo puede importar de: su propia carpeta + `packages/*`.
→ Enforcement objetivo: `dependency-cruiser` rule `no-cross-service-import`
→ Estado: manual

### 🔴 Cero `as any` y `as unknown as` en repositories
Usar `toEntity()` privado que mapea Prisma → dominio campo por campo.
Excepción documentada: campos JSONB de Prisma marcados con `// @ecosistema-ms/jsonb-cast`.
→ Enforcement objetivo: ESLint `no-explicit-any` + `no-unsafe-assignment`
→ Estado: manual — molde a crear en conversations/ de chatia-backend

### 🔴 Ningún controller gRPC con lógica de negocio
El controller gRPC es un adaptador de transporte.
Toda lógica condicional, toda validación de negocio → va en el Service.
→ Estado: manual — revisión en PR

### 🔴 Todo .proto nuevo tiene su módulo en packages/grpc-client
Agregar el .proto sin el módulo cliente es dejar el contrato sin consumidor tipado.
→ Estado: manual

### 🔴 Ningún servicio llama a otro por HTTP si existe el .proto
Si el contrato gRPC está definido, la llamada HTTP es un bypass del contrato.
Excepción documentada: cuando el .proto no existe aún → `// TODO(grpc): ...`
→ Estado: manual

### 🟡 Un test de domain nunca importa @nestjs/* ni @prisma/client
El domain es lógica pura — si necesita NestJS para testearse, la separación falló.
→ Estado: no aplica aún — Domain pendiente

### 🟡 Circuit-breaker debe tener timeout y fallback documentados
El `CircuitBreakerService` en `chatia-backend/common/` opera en memoria.
Con más de 1 réplica en Railway, el circuit-breaker pierde estado entre réplicas.
Documentar el comportamiento esperado con múltiples réplicas antes de escalar.
→ Estado: pendiente de decisión antes de escalar

### 🔵 Carpetas BLOQUEANTES no se modifican sin ADR
Ver `services/<servicio>.md` para la clasificación por servicio.
Cambiar la interfaz de un canal, el contrato de un provider, o los módulos
de infraestructura requiere ADR previo.
→ Estado: convención — se hace visible en PR
